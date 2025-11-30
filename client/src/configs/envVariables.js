const Reset = "\x1b[0m";
const FgYellow = "\x1b[33m";

const APP_ENV = "prod";
let APP_HOST = "https://mernchat-production-d169.up.railway.app";

switch (APP_ENV) {
  case "local":
    console.log("connecting to local");
    APP_HOST = "http://localhost:5000";
    break;
  case "prod":
    console.log("connecting to prod");
    APP_HOST = "https://mernchat-production-d169.up.railway.app";
    break;
  default:
    console.log("connecting to default api (local)");
    APP_HOST = "https://mernchat-production-d169.up.railway.app";
    break;
}

console.log(FgYellow, APP_ENV, Reset);
console.log(FgYellow, APP_HOST, Reset);

export default APP_HOST;
