document.addEventListener('DOMContentLoaded', function () {
  fetchRoles();
  fetchAndDisplaySavedQueries();
});

document.getElementById('queryForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const submitButton = document.getElementById('submitButton');
  const loadingIndicator = document.getElementById('loading');
  const roleSelect = document.getElementById('roleSelect');
  const queryInput = document.getElementById('queryInput');
  const role = roleSelect.value;
  const query = queryInput.value;

  submitButton.disabled = true;
  loadingIndicator.style.display = 'block';

  fetch('/generate-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, query }),
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById('response').innerHTML = `<pre>Generated Reply: ${data.message}</pre>`;
    })
    .catch(error => {
      console.error('Error:', error);
      document.getElementById('response').innerHTML = `<pre>Error generating reply.</pre>`;
    })
    .finally(() => {
      submitButton.disabled = false;
      loadingIndicator.style.display = 'none';
      fetchAndDisplaySavedQueries();
    });
});

function fetchRoles() {
  fetch('/roles')
    .then(response => response.json())
    .then(data => {
      const roleSelect = document.getElementById('roleSelect');
      data.forEach(role => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role.replace(/-/g, ' ').trim();
        roleSelect.appendChild(option);
      });
    })
    .catch(error => console.error('Error fetching roles:', error));
}

function fetchAndDisplaySavedQueries() {
  fetch('/saved-queries')
    .then(response => response.json())
    .then(queries => {
      const container = document.getElementById('savedQueries');
      container.innerHTML = '<h2>Saved Queries</h2>';
      queries.forEach((query, index) => {
        const element = document.createElement('div');
        element.innerHTML = `<pre><strong>Role:</strong> ${query.role}\n<strong>Query:</strong> ${query.query}\n<strong>Response:</strong> ${query.response}\n<strong>Timestamp:</strong> ${query.timestamp}</pre>`;
        container.appendChild(element);
        if (index < queries.length - 1) {
          const divider = document.createElement('hr');
          container.appendChild(divider);
        }
      });
    })
    .catch(error => console.error('Error fetching saved queries:', error));
}
