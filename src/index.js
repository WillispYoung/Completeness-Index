const { app, ipcMain, BrowserWindow } = require('electron');

const WINDOW_SIZE = { width: 800, height: 600 };

app.on('ready', () => {
    window = new BrowserWindow({
        width: WINDOW_SIZE.width,
        height: WINDOW_SIZE.height,
        webPreferences: {
            nodeIntegration: true
        }
    });

    window.loadFile('src/index.html');
});
