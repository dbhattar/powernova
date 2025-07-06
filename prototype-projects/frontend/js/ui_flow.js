import { createRoot } from 'react-dom/client';

function NavigationBar() {
  // TODO: Actually implement a navigation bar
  return <h1>Hello from React!</h1>;
}

const domNode = document.getElementById('react-flow-container');
const root = createRoot(domNode);
root.render(<NavigationBar />);