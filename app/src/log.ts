import { dirname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream, WriteStream } from 'fs';

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

const __args = parseSimpleArgs(process.argv.slice(2));

const logfile = __args['logfile']
  ? normalize(__args['logfile'])
  : join(dirname(fileURLToPath(import.meta.url)), '../../peek.log');

let logStream: WriteStream | null = null;

interface Logger {
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
}

function formatter(level: string, msg: string, args: any[]) {
  const timestamp = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    fractionalSecondDigits: 3,
  });

  const pid = process.pid.toString().padEnd(8, ' ');

  return `${level.padEnd(9, ' ')} ${pid} ${timestamp}  ${msg} ${args.join(' ')}\n`;
}

function setupLogger(): Logger {
  logStream = createWriteStream(logfile, { flags: 'a' });
  
  const logger: Logger = {
    info: (...args: any[]) => {
      const formatted = formatter('INFO', args[0] || '', args.slice(1));
      logStream?.write(formatted);
      console.log(...args);
    },
    error: (...args: any[]) => {
      const formatted = formatter('ERROR', args[0] || '', args.slice(1));
      logStream?.write(formatted);
      console.error(...args);
    },
    warn: (...args: any[]) => {
      const formatted = formatter('WARN', args[0] || '', args.slice(1));
      logStream?.write(formatted);
      console.warn(...args);
    }
  };

  return logger;
}

function get(): Logger {
  if (!logStream) {
    return setupLogger();
  }
  
  return {
    info: (...args: any[]) => {
      const formatted = formatter('INFO', args[0] || '', args.slice(1));
      logStream?.write(formatted);
      console.log(...args);
    },
    error: (...args: any[]) => {
      const formatted = formatter('ERROR', args[0] || '', args.slice(1));
      logStream?.write(formatted);
      console.error(...args);
    },
    warn: (...args: any[]) => {
      const formatted = formatter('WARN', args[0] || '', args.slice(1));
      logStream?.write(formatted);
      console.warn(...args);
    }
  };
}

export default { setupLogger, get };
