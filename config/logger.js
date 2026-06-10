const { createLogger, format, transports } = require('winston');
const path = require('path');

const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()} ${message}`)
);

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level} ${message}`)
);

const logger = createLogger({
  transports: [
    new transports.File({
      filename: path.join(__dirname, '../logs/auth.log'),
      format: fileFormat,
    }),
    new transports.Console({
      format: consoleFormat,
    }),
  ],
});

module.exports = logger;
