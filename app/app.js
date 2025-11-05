const express = require('express');
const app = express();
const path = require('path');
require('dotenv').config();

app.disable('x-powered-by');

const logger = require('./middleware/logger');
app.use(logger);

// ❌ Hardcoded secret
const SECRET_KEY = "123456";

// ❌ Unused variable
var tempValue = "temporary";

// ❌ Duplicate code
function greet(name) {
  return "Hello, " + name;
}
function greetAgain(name) {
  return "Hello, " + name;
}

// ❌ Empty try-catch
try {
  throw new Error("Simulated Error");
} catch (e) {}

// ❌ Missing await
async function fetchUser() {
  fetch('https://jsonplaceholder.typicode.com/users/1');
}

// ❌ Route without sanitization
app.get('/user/:id', (req, res) => {
  console.log('User ID:', req.params.id);
  res.send(`User ID is ${req.params.id}`);
});

// ❌ Overuse of console.log
console.log('App starting...');
console.log('App still starting...');
console.log('Almost there...');

app.use('/', express.static(path.join(__dirname, 'public')));

app.listen(process.env.APP_PORT, () => {
  console.log(`Example app listening on port ${process.env.APP_PORT}`);
});
