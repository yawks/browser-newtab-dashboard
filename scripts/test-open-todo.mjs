import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the TypeScript adapter without adding a test framework to the project.
const bundle = await build({
  entryPoints: ['src/plugins/open-todo/api.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
const config = { apiEndpoint: 'https://todo.example.com/', apiToken: 'ot_test' };
const requests = [];
let status = 200;
let payload;
globalThis.fetch = async (url, options) => {
  requests.push({ url, options });
  return new Response(JSON.stringify(payload), { status });
};

payload = { tasks: [
  { id: 'parent', title: 'Parent', due: { date: '2026-11-18', time: '09:00', tz: 'Europe/Paris' }, priority: 1, labels: ['label'], project_id: 'project' },
  { id: 'child', title: 'Child', parent_id: 'parent', completed_at: 123 },
  { id: 'deleted', title: 'Deleted', deleted_at: 123 },
  { id: 'skipped', title: 'Skipped occurrence', skipped: true, completed_at: 123 },
] };
const tasks = await api.fetchOpenTodoTasks(config, false, 'frame', 3600);
assert.equal(requests[0].url, 'https://todo.example.com/api/v1/tasks');
assert.equal(requests[0].options.headers.Authorization, 'Bearer ot_test');
assert.equal(tasks.length, 2);
assert.equal(tasks[0].dueDate, '2026-11-18T00:00:00');
assert.equal(tasks[0].completed, false);
assert.deepEqual(tasks[0].subtasks, { completed: 1, total: 1 });
assert.deepEqual(tasks[0].labelIds, ['label']);
assert.equal(tasks[0].projectId, 'project');
assert.equal(tasks[1].completed, true);
assert.equal(tasks[1].priority, 4);
assert.equal(tasks[1].dueDate, null);

await api.fetchOpenTodoTasks(config, false, 'frame', 3600);
assert.equal(requests.length, 1, 'Cache should avoid a second request');
await api.fetchOpenTodoTasks(config, true, 'frame', 3600);
assert.equal(requests.length, 2, 'Forced refresh should bypass cache');
await api.fetchOpenTodoTasks(config, false, 'frame', 0);
assert.equal(requests.length, 3, 'Disabled cache should fetch');

payload = { labels: [{ id: 'label', name: 'Work', color: '#ff0000' }, { id: 'deleted', name: 'Gone', deleted_at: 1 }] };
const labels = await api.fetchOpenTodoTags(config, false, 'frame', 3600);
assert.deepEqual(labels, [{ id: 'label', name: 'Work', color: '#ff0000' }]);
assert.equal(requests.at(-1).url, 'https://todo.example.com/api/v1/labels');
payload = { projects: [{ id: 'project', name: 'Project', color: '#0000ff' }] };
const projects = await api.fetchOpenTodoProjects({ ...config, apiEndpoint: 'https://todo.example.com/api/v1/' });
assert.equal(projects[0].name, 'Project');
assert.equal(requests.at(-1).url, 'https://todo.example.com/api/v1/projects');

payload = { id: 'parent', title: 'Parent', completed_at: 123 };
await api.updateOpenTodoTask(config, 'parent', true, 'frame');
assert.equal(requests.at(-1).options.method, 'PATCH');
assert.equal(requests.at(-1).url, 'https://todo.example.com/api/v1/tasks/parent');
assert.equal(typeof JSON.parse(requests.at(-1).options.body).completed_at, 'number');
assert.equal(storage.has('plugin_cache_frame'), false, 'Completion must invalidate task cache');
await api.updateOpenTodoTask(config, 'parent', false);
assert.deepEqual(JSON.parse(requests.at(-1).options.body), { completed_at: null });

status = 403;
payload = { error: { code: 'insufficient_scope', message: 'Read-only token' } };
await assert.rejects(api.updateOpenTodoTask(config, 'parent', true), /Read-only token/);
console.log('Open Todo adapter tests passed (mapping, filters, cache, endpoints, completion and API errors).');
