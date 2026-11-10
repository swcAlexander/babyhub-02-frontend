import fs from 'node:fs/promises';
import dotenv from 'dotenv';

export const safetyError = (code) => Object.assign(new Error(code), { code });
export const TARGETS = Object.freeze({
  test: Object.freeze({ dbName: 'db-babyhub-test', variable: 'DB_HOST_TEST', namespace: 'baby-service-test' }),
  main: Object.freeze({ dbName: 'db-babyhub', variable: 'DB_HOST', namespace: 'baby-service' }),
});

export const targetFor = (target) => {
  if (!Object.hasOwn(TARGETS, target)) throw safetyError('TARGET_REQUIRED');
  return TARGETS[target];
};

export const assertTargetDatabase = (databaseName, target) => {
  if (databaseName !== targetFor(target).dbName) throw safetyError('UNSAFE_DATABASE');
};

export const assertWriteAuthorization = ({ confirmed, target, confirmDatabase }) => {
  if (confirmed !== true) return;
  const specification = targetFor(target);
  if (target === 'main' && confirmDatabase !== specification.dbName) {
    throw safetyError('MAIN_DATABASE_CONFIRMATION_REQUIRED');
  }
  if (target === 'test' && confirmDatabase !== undefined) throw safetyError('INVALID_ARGUMENTS');
};

// Shared strict parser. No default target may ever authorize a write.
export const parseTargetArguments = (args, { maxPositional = 0 } = {}) => {
  const result = { confirmed: false, target: undefined, confirmDatabase: undefined, positional: [] };
  for (const arg of args) {
    if (arg === '--confirm-import' && !result.confirmed) result.confirmed = true;
    else if (arg.startsWith('--target=') && result.target === undefined) {
      result.target = arg.slice('--target='.length);
      targetFor(result.target);
    } else if (arg.startsWith('--confirm-database=') && result.confirmDatabase === undefined) {
      result.confirmDatabase = arg.slice('--confirm-database='.length);
    } else if (arg.startsWith('--')) throw safetyError('INVALID_ARGUMENTS');
    else result.positional.push(arg);
  }
  if (result.positional.length > maxPositional) throw safetyError('INVALID_ARGUMENTS');
  if (result.confirmDatabase !== undefined &&
      (result.target !== 'main' || result.confirmDatabase !== TARGETS.main.dbName)) throw safetyError('INVALID_ARGUMENTS');
  assertWriteAuthorization(result);
  return result;
};

export const loadTargetConfiguration = async ({ target = 'test', readFile = fs.readFile } = {}) => {
  const specification = targetFor(target);
  let values;
  try { values = dotenv.parse(await readFile(new URL('../../.env', import.meta.url), 'utf8')); }
  catch { throw safetyError('TARGET_ENV_UNAVAILABLE'); }
  // Read the file explicitly: a previous shell's DB_HOST override must not select another DB.
  const uri = values[specification.variable]?.trim();
  if (!uri) throw safetyError(`${specification.variable}_REQUIRED`);
  try {
    const parsed = new URL(uri);
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
        !['', '/', `/${specification.dbName}`].includes(decodeURIComponent(parsed.pathname))) throw new Error();
  } catch { throw safetyError('UNSAFE_DATABASE_URI'); }
  return Object.freeze({ target, uri, dbName: specification.dbName });
};

export const openTargetConnection = async (models, configuration) => {
  assertTargetDatabase(configuration.dbName, configuration.target);
  const connection = models.mongoose.createConnection(configuration.uri, {
    dbName: configuration.dbName, autoCreate: false, autoIndex: false,
    bufferCommands: false, serverSelectionTimeoutMS: 10000,
  });
  try {
    await connection.asPromise();
    assertTargetDatabase(connection.db?.databaseName, configuration.target);
    return connection;
  } catch (error) {
    await connection.close().catch(() => {});
    throw error;
  }
};
