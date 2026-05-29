(() => {
  // Prevent multiple injections
  if (document.getElementById('browser-clock-launcher-overlay')) return;

  if (!('documentPictureInPicture' in window)) {
    alert('The Document Picture-in-Picture API is not supported in your current browser version. Please update your browser to use the Always-on-Top feature.');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'browser-clock-launcher-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0', left: '0', width: '100vw', height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: '2147483647', // max z-index
    fontFamily: 'sans-serif'
  });

  const dialog = document.createElement('div');
  Object.assign(dialog.style, {
    backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.8)', textAlign: 'center', color: '#fff',
    maxWidth: '350px'
  });

  const title = document.createElement('h2');
  title.innerText = 'Launch Floating Clock';
  title.style.marginTop = '0';

  const desc = document.createElement('p');
  desc.innerText = 'Click the button below to spawn the clock as an always-on-top window.';
  desc.style.color = '#aaa';
  desc.style.lineHeight = '1.4';

  const btnContainer = document.createElement('div');
  btnContainer.style.marginTop = '20px';
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '10px';
  btnContainer.style.justifyContent = 'center';

  const launchBtn = document.createElement('button');
  launchBtn.innerText = 'Launch';
  Object.assign(launchBtn.style, {
    backgroundColor: '#7b2cbf', color: '#fff', border: 'none', padding: '10px 20px',
    fontSize: '15px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer',
    flex: '1', transition: 'background 0.2s'
  });
  launchBtn.onmouseover = () => launchBtn.style.backgroundColor = '#9d4edd';
  launchBtn.onmouseout = () => launchBtn.style.backgroundColor = '#7b2cbf';

  const cancelBtn = document.createElement('button');
  cancelBtn.innerText = 'Cancel';
  Object.assign(cancelBtn.style, {
    backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555',
    padding: '10px 20px', fontSize: '15px', borderRadius: '8px', cursor: 'pointer',
    flex: '1', transition: 'background 0.2s'
  });
  cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#333';
  cancelBtn.onmouseout = () => cancelBtn.style.backgroundColor = 'transparent';

  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(launchBtn);
  
  dialog.appendChild(title);
  dialog.appendChild(desc);
  dialog.appendChild(btnContainer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  cancelBtn.addEventListener('click', () => overlay.remove());

  let pipWindow = null;

  launchBtn.addEventListener('click', async () => {
    overlay.remove();
    try {
      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 430,
        height: 520
      });

      // Reset default margins of the new window
      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.overflow = 'hidden';
      pipWindow.document.body.style.backgroundColor = '#121212';

      // Inject iframe pointing to the extension's popup.html
      const iframe = pipWindow.document.createElement('iframe');
      iframe.src = chrome.runtime.getURL('popup.html');
      iframe.style.width = '100vw';
      iframe.style.height = '100vh';
      iframe.style.border = 'none';
      iframe.style.display = 'block';

      pipWindow.document.body.appendChild(iframe);

    } catch (e) {
      console.error(e);
      alert('Failed to launch floating window. Ensure you are interacting with the page and permissions are granted.');
    }
  });

  // Listen for message from the iframe to close the PiP window
  window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'closePip') {
      if (pipWindow) {
        pipWindow.close();
      }
    }
  });

})();