import { r as jsxFactory, t as reactDomFactory } from './framework-CXnKph_e.js';
import App from './os-client-DeMZwioN.js';

const jsxRuntime = jsxFactory();
const ReactDOM = reactDomFactory();

const rootEl = document.getElementById('root');
rootEl.innerHTML = '';

const currentUser = 'Денис Марсельевич';
const currentEmail = 'admin@getsite.uz';

ReactDOM.createRoot(rootEl).render(
  jsxRuntime.jsx(App, { currentUser, currentEmail })
);
