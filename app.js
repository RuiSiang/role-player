const Koa = require('koa');
const Router = require('@koa/router');
const OpenAI = require('openai');
const serve = require('koa-static');
const path = require('path');
const bodyParser = require('koa-bodyparser');
const fs = require('fs-extra')

const app = new Koa();
const router = new Router();

require('dotenv').config();
app.use(serve(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use(bodyParser());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_APIKEY,
});

let backstories = {};
async function loadBackstories() {
  const data = fs.readFileSync('info.json', 'utf8');
  backstories = JSON.parse(data);
}
loadBackstories();

function saveQueryRecord(role, query, response) {
  const record = { role, query, response, timestamp: new Date().toISOString() };
  try {
    // Ensure the file exists. Create it with an empty array if it doesn't.
    fs.ensureFileSync('queries.json');
    const data = fs.readJsonSync('queries.json', { throws: false }) || [];
    data.push(record);
    fs.writeJsonSync('queries.json', data);
  } catch (error) {
    console.error('Error saving query record:', error);
  }
}

router.get('/roles', async (ctx) => {
  ctx.body = Object.keys(backstories);
});

router.get('/backstory/:role', async (ctx) => {
  const { role } = ctx.params;
  ctx.body = backstories[role] || 'Role not found';
});

router.get('/saved-queries', async (ctx) => {
  try {
    const data = await fs.readJson('queries.json', { throws: false }) || [];
    ctx.body = data.reverse()
  } catch (error) {
    console.error('Error retrieving saved queries:', error);
    ctx.body = [];
  }
});

function generatePrompt(roleDetails, userQuery) {
  let prompt = `${roleDetails.description}\n\nAvailable Actions:\n`;

  roleDetails.actions.forEach((action, index) => {
    prompt += `\n${index + 1}. Action: ${action.action}\n`;
    prompt += `Conditions: ${action.conditions}\n`;
    prompt += `Response Template: "${action["response-template"]}"\n`;
  });

  prompt += `\nUser Request: "${userQuery}"\n\nGiven the user's request and the conditions for action, how would you respond based on the provided templates? Provide your reply and also additional information based on the user's request, but strictly relevant to your role. Format your output as a professional email.`;

  return prompt;
}

router.post('/generate-reply', async (ctx) => {
  const { role, query } = ctx.request.body;
  const roleDetails = backstories[role];
  if (!roleDetails) {
    ctx.body = 'Role not found';
    return;
  }

  const prompt = generatePrompt(roleDetails, query)
  // console.log(prompt)
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: 'user', content: prompt }],
  }).asResponse()
  if (response.ok) {
    const data = await response.json()
    generatedResponse = data.choices[0].message.content
    saveQueryRecord(role, query, generatedResponse);
    ctx.body = { message: generatedResponse }

  }
  else {
    ctx.status = 400
  }

});

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
