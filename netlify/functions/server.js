export const handler = async (event, context) => {
  if (!global.__netlify_handler) {
    // dynamic import to avoid ESM/CommonJS loader issues
    const serverlessModule = await import('serverless-http');
    const serverless = serverlessModule.default ?? serverlessModule;
    const appModule = await import('../../backend/server.js');
    const app = appModule.default ?? appModule.app ?? appModule;
    global.__netlify_handler = serverless(app);
  }
  return global.__netlify_handler(event, context);
};
