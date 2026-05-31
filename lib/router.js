'use strict';

const tasksHandler = require('./tasks-handler');
const util = require('./handler-util');

function route(req, res) {
  switch (req.url) {
    case '/': 
      res.writeHead(302, { 'Location': '/tasks' });
      res.end();
      break;
    case '/tasks': 
      tasksHandler.handle(req, res);
      break;
    case '/tasks/delete': // 変更: 削除機能のURL
      tasksHandler.handleDelete(req, res);
      break;
    case '/tasks/toggle': // 追加: 完了/未完了の切り替え機能のURL
      tasksHandler.handleToggle(req, res);
      break;
    case '/logout':
      util.handleLogout(req, res);
      break;
    case '/changeTheme':
      util.handleChangeTheme(req, res);
      break;
    case '/favicon.ico':
      util.handleFavicon(req, res);
      break;
    case '/style.css':
      util.handleStyleCssFile(req, res);
      break;
    case '/nn-chat.js': 
      util.handleNnChatJsFile(req, res);
      break;
    default:
      util.handleNotFound(req, res);
      break;
  }
}

module.exports = {
  route
};