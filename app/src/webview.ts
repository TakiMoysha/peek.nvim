// Simple argument parser
function parseSimpleArgs(args: string[]) {
  const result: Record<string, any> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (value !== undefined) {
        result[key] = value;
      } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
        result[key] = args[i + 1];
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

const { url, theme, serverUrl } = parseSimpleArgs(process.argv.slice(2));

// For Node.js, we'll use the open package to open the URL in the default browser
// This is a simplified version - in a real implementation you might want to use
// a webview library like electron or similar
import open from 'open';

console.log('Opening webview with:', { url, theme, serverUrl });

// Open the URL in the default browser
open(url).catch(console.error);

// Keep the process alive briefly to ensure the browser opens
setTimeout(() => {
  process.exit();
}, 1000);
