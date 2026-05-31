'use strict';
const pug = require('pug');
const Cookies = require('cookies');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const util = require('./handler-util');
const { currentThemeKey } = require('../config');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const relativeTime = require('dayjs/plugin/relativeTime');
require('dayjs/locale/ja');
dayjs.locale('ja');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.tz.setDefault('Asia/Tokyo');
const crypto = require('node:crypto');

const oneTimeTokenMap = new Map();

async function handle(req, res) {
  const cookies = new Cookies(req, res);
  const currentTheme = cookies.get(currentThemeKey) || 'light';
  const options = { maxAge: 30 * 86400 * 1000 };
  cookies.set(currentThemeKey, currentTheme, options);

  switch (req.method) {
    case 'GET':
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      // タスクを取得（未完了を上に、新しいものを上に並べる）
      const tasks = await prisma.task.findMany({
        orderBy: [
          { isDone: 'asc' },
          { id: 'desc' }
        ]
      });
      tasks.forEach((task) => {
        task.relativeCreatedAt = dayjs(task.createdAt).tz().fromNow();
        task.absoluteCreatedAt = dayjs(task.createdAt).tz().format('YYYY年MM月DD日 HH時mm分ss秒');
      });
      const oneTimeToken = crypto.randomBytes(8).toString('hex');
      oneTimeTokenMap.set(req.user, oneTimeToken);
      res.end(pug.renderFile('./views/tasks.pug', {
        currentTheme,
        tasks,
        user: req.user,
        oneTimeToken
      }));
      break;
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', async () => {
        const params = new URLSearchParams(body);
        const content = params.get('content');
        const deadline = params.get('deadline') || null;
        const requestedOneTimeToken = params.get('oneTimeToken');
        if (!content) {
          handleRedirectTasks(req, res);
          return;
        }
        if (!requestedOneTimeToken || oneTimeTokenMap.get(req.user) !== requestedOneTimeToken) {
          util.handleBadRequest(req, res);
          return;
        }
        await prisma.task.create({
          data: {
            content,
            postedBy: req.user,
            deadline
          }
        });
        oneTimeTokenMap.delete(req.user);
        handleRedirectTasks(req, res);
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

function handleRedirectTasks(req, res) {
  res.writeHead(303, {
    'Location': '/tasks'
  });
  res.end();
}

function handleDelete(req, res) {
  switch (req.method) {
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', async () => {
        const params = new URLSearchParams(body);
        const id = parseInt(params.get('id'));
        const task = await prisma.task.findUnique({ where: { id } });
        if (!task) {
          util.handleBadRequest(req, res);
          return;
        }
        if (req.user === task.postedBy || req.user === 'admin') {
          await prisma.task.delete({ where: { id } });
          handleRedirectTasks(req, res);
        }
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

// 追加：完了/未完了を切り替える処理
function handleToggle(req, res) {
  switch (req.method) {
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', async () => {
        const params = new URLSearchParams(body);
        const id = parseInt(params.get('id'));
        const deadline = params.get('deadline') || null;
        const isDone = params.get('isDone') === 'true'; 
        
        const task = await prisma.task.findUnique({ where: { id } });
        if (!task) {
          util.handleBadRequest(req, res);
          return;
        }
        if (req.user === task.postedBy || req.user === 'admin') {
          await prisma.task.update({
            where: { id },
            data: { isDone }
          });
          handleRedirectTasks(req, res);
        }
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

module.exports = {
  handle,
  handleDelete,
  handleToggle
};