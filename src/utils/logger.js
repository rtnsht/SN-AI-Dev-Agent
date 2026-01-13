/**
 * Logger Utility
 * Provides consistent logging across the framework
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    this.currentLevel = 'info';
    this.logFile = null;
  }

  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.currentLevel = level;
    }
  }

  setLogFile(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.logFile = filePath;
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.currentLevel];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (data) {
      formatted += `\n${JSON.stringify(data, null, 2)}`;
    }
    return formatted;
  }

  writeToFile(message) {
    if (this.logFile) {
      fs.appendFileSync(this.logFile, message + '\n');
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message, data);
      console.log(chalk.gray(formatted));
      this.writeToFile(formatted);
    }
  }

  info(message, data = null) {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message, data);
      console.log(chalk.blue(formatted));
      this.writeToFile(formatted);
    }
  }

  success(message, data = null) {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message, data);
      console.log(chalk.green(formatted));
      this.writeToFile(formatted);
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message, data);
      console.log(chalk.yellow(formatted));
      this.writeToFile(formatted);
    }
  }

  error(message, data = null) {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage('error', message, data);
      console.log(chalk.red(formatted));
      this.writeToFile(formatted);
    }
  }

  // Special formatting for workflow steps
  step(stepNumber, totalSteps, message) {
    console.log(chalk.cyan(`\n[${ stepNumber }/${ totalSteps }] `) + chalk.white.bold(message));
  }

  // Box for important information
  box(title, content) {
    const width = 60;
    const line = '─'.repeat(width);
    console.log(chalk.cyan(`\n┌${line}┐`));
    console.log(chalk.cyan('│ ') + chalk.white.bold(title.padEnd(width - 1)) + chalk.cyan('│'));
    console.log(chalk.cyan(`├${line}┤`));
    const lines = content.split('\n');
    for (const l of lines) {
      console.log(chalk.cyan('│ ') + l.padEnd(width - 1) + chalk.cyan('│'));
    }
    console.log(chalk.cyan(`└${line}┘`));
  }
}

export const logger = new Logger();
export default logger;

