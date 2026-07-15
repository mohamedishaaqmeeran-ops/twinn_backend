const youtubeProcesses =
  new Map();

const normalizeUserId = (
  userId
) => String(userId);

exports.getProcess = (
  userId
) => {
  return youtubeProcesses.get(
    normalizeUserId(userId)
  );
};

exports.setProcess = (
  userId,
  process
) => {
  youtubeProcesses.set(
    normalizeUserId(userId),
    process
  );
};

exports.removeProcess = (
  userId
) => {
  youtubeProcesses.delete(
    normalizeUserId(userId)
  );
};

exports.stopProcess = (
  userId
) => {
  const key =
    normalizeUserId(userId);

  const process =
    youtubeProcesses.get(key);

  if (!process) {
    return false;
  }

  if (!process.killed) {
    process.kill("SIGTERM");

    setTimeout(() => {
      if (!process.killed) {
        process.kill("SIGKILL");
      }
    }, 5000);
  }

  youtubeProcesses.delete(key);

  return true;
};