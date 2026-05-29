const killPort = require('kill-port');

async function main() {
  const rawPort = process.env.PORT || '3002';
  const port = Number.parseInt(rawPort, 10);

  if (Number.isNaN(port) || port <= 0) {
    console.error(`Invalid PORT value: ${rawPort}`);
    process.exit(1);
    return;
  }

  try {
    await killPort(port);
    console.log(`Freed port ${port}`);
  } catch (error) {
    // If nothing is listening, we still want startup to continue.
    console.log(`Port ${port} was already free`);
  }
}

main();
