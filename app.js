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
let cases = {}
async function loadBackstories() {
  const backstoriesData = fs.readFileSync('roles.json', 'utf8');
  backstories = JSON.parse(backstoriesData);
  const casesData = fs.readFileSync('cases.json', 'utf8');
  cases = JSON.parse(casesData);
}
loadBackstories();

let data = { g1: [], g2: [], g3: [], g4: [] }

function saveQueryRecord(role, query, response, group) {
  const record = { role, query, response, timestamp: new Date().toISOString() };
  try {
    // Ensure the file exists. Create it with an empty array if it doesn't.

    data[group].push(record);
  } catch (error) {
    console.error('Error saving query record:', error);
  }
}

router.get(['/comms/roles', '/roles'], async (ctx) => {
  ctx.body = Object.keys(backstories);
});

router.get(['/comms/backstory/:role', '/backstory/:role'], async (ctx) => {
  const { role } = ctx.params;
  ctx.body = backstories[role] || 'Role not found';
});

router.get(['/comms/saved-queries/:group', '/saved-queries/:group'], async (ctx) => {
  if (!ctx.params.group.match(/g[1-4]/)) {
    return;
  }
  try {
    ctx.body = data[ctx.params.group]
  } catch (error) {
    console.error('Error retrieving saved queries:', error);
    ctx.body = [];
  }
});

function generatePrompt(roleDetails, caseBackground, userQuery) {
  let prompt = `Role Overview:\n- Name: ${roleDetails.name}\n- Position: ${roleDetails.position}\n- Description: ${roleDetails.description}\n\nResponsibilities:\n- ${roleDetails.responsibilities}\n\n`;
  prompt += `Case Background:\n${caseBackground.overview}\n\n`;
  prompt += `Key Events:\n`;
  caseBackground.keyEvents.forEach((event, index) => {
    prompt += `- ${index + 1}. ${event}\n`;
  });
  if (roleDetails.name === "Blockchain Analysis Specialist" || roleDetails.name === "Analyst Morgan") {
    prompt += `\nTransaction Details:\n`;
    caseBackground.transactionDetails.forEach((detail, index) => {
      prompt += `- ${index + 1}. ${detail}\n`;
    });
  }
  if (["Blockchain Analysis Specialist", "Team DigitalVault", "Analyst Morgan"].includes(roleDetails.name)) {
    prompt += `\nAddress Tags:\n`;
    caseBackground.addressTags.forEach((tag, index) => {
      prompt += `- ${index + 1}. ${tag}\n`;
    });
  }
  if (["ICCA Agent", "Analyst Morgan"].includes(roleDetails.name)) {
    prompt += `\nSuspects:\n`;
    caseBackground.suspects.forEach((suspect, index) => {
      prompt += `- ${index + 1}. Name: ${suspect.name}, Role: ${suspect.role}\n`;
    });
  }
  prompt += `\nAvailable Actions:\n`;
  roleDetails.actions.forEach((action, index) => {
    // prompt += `\n${index + 1}. Action: ${action.name}\n   - Description: ${action.description}\n   - Conditions: ${action.conditions}\n   - Evidence Required: ${action.evidenceRequired}\n   - Response Template: "${action.responseTemplate}"\n`;
    prompt += `\n${index + 1}. Action: ${action.name}\n   - Description: ${action.description}\n   - Conditions: ${action.conditions}\n   - Evidence Required: ${action.evidenceRequired}\n`;
  });
  prompt += `\nUser Request: "${userQuery}"\n\nBased on the user's request and the conditions for each action, how would you respond? Include additional relevant information strictly only from your role's perspective and information you can get at the current investigative stage. Request additional info if the user does not provide sufficient info.\n\nFormat your output as a format fit for your specific role.`;
  return prompt;
}

router.post(['/comms/generate-reply/:group', '/generate-reply/:group'], async (ctx) => {
  const { role, query } = ctx.request.body;
  const roleDetails = backstories[role];
  if (!roleDetails) {
    ctx.body = 'Role not found';
    return;
  }
  if (!ctx.params.group.match(/g[1-4]/)) {
    return;
  }
  const prompt = generatePrompt(roleDetails, cases[ctx.params.group], query)
  // console.log(prompt)
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: 'user', content: prompt }],
  }).asResponse()
  if (response.ok) {
    const data = await response.json()
    generatedResponse = data.choices[0].message.content.replace('[Your Name]', '').replace('[User\'s Name]', 'User')
    saveQueryRecord(role, query, generatedResponse, ctx.params.group);
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
