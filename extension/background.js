// O ícone abre a aplicação completa em uma nova aba (não em popup).
// Nenhuma permissão é necessária para isso.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
