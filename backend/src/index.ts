import express from 'express';

// Placeholder entry point for Step 3.
// Env validation (Step 6) and the /health route (Step 10) are added in later steps.
const app = express();

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Tubo backend listening on port ${PORT}`);
});
