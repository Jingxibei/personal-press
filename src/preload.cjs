const { contextBridge, ipcRenderer } = require('electron');

const invoke = (name, payload) => ipcRenderer.invoke(`press:${name}`, payload);
const api = {
  getState: () => invoke('getState'),
  saveSettings: settings => invoke('saveSettings', settings),
  saveCredential: payload => invoke('saveCredential', payload),
  listModels: payload => invoke('listModels', payload),
  generateToday: () => invoke('generateToday'),
  getIssue: id => invoke('getIssue', id),
  getSample: () => invoke('getSample'),
  exportIssue: payload => invoke('exportIssue', payload),
  listPrinters: () => invoke('listPrinters'),
  testPrint: payload => invoke('testPrint', payload),
  printIssue: payload => invoke('printIssue', payload),
  getPrintJobs: () => invoke('getPrintJobs'),
  openSource: url => invoke('openSource', url),
  onStateChanged: callback => {
    if (typeof callback !== 'function') throw new TypeError('A callback is required.');
    const listener = () => callback();
    ipcRenderer.on('press:state-changed', listener);
    return () => ipcRenderer.removeListener('press:state-changed', listener);
  }
};
contextBridge.exposeInMainWorld('press', Object.freeze(api));
