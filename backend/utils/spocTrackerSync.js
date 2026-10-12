// Mirrors "Task for SPOC" client messages onto the Tracker calendar.
//
// ClientMessage is the source of truth: every save of a SPOC task upserts one
// Task (sourceType 'spoctask', sourceId = message id), and deleting the
// message deletes it. The only thing that flows back the other way is
// completion — ticking the task in the Tracker sets the message's status.
const Task = require('../models/Task');

const SOURCE_TYPE = 'spoctask';

const istHHmm = (date) => {
  const d = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// The message body is free text, often several numbered points; the calendar
// block needs a one-line title, and the full text goes in notes.
const titleFrom = (message) => {
  const first = String(message || '').split('\n').map((l) => l.trim()).find(Boolean) || 'SPOC task';
  return first.length > 90 ? `${first.slice(0, 87)}…` : first;
};

// Task.priority has no 'Urgent'.
const priorityFrom = (p) => (p === 'Urgent' || p === 'High' ? 'High' : p === 'Low' ? 'Low' : 'Medium');

const taskFieldsFor = (msg) => ({
  title: titleFrom(msg.message),
  date: msg.receivedAt || msg.createdAt || new Date(),
  startTime: istHHmm(msg.receivedAt || msg.createdAt || new Date()),
  category: 'Internal',
  priority: priorityFrom(msg.priority),
  spoc: msg.assignedTo || msg.clientName || '',
  assignedDate: msg.createdAt || new Date(),
  deadline: msg.deadline || null,
  completed: msg.status === 'Completed',
  notes: msg.message || '',
  sourceType: SOURCE_TYPE,
  sourceId: String(msg._id),
  createdBy: msg.createdBy?._id || msg.createdBy || undefined,
});

const syncSpocTask = async (msg) => {
  try {
    if (msg.taskType !== 'spoc') {
      // A message switched from SPOC to client task leaves the calendar.
      await Task.deleteMany({ sourceType: SOURCE_TYPE, sourceId: String(msg._id) });
      return;
    }
    await Task.updateOne(
      { sourceType: SOURCE_TYPE, sourceId: String(msg._id) },
      { $set: taskFieldsFor(msg) },
      { upsert: true }
    );
  } catch (err) {
    console.error('syncSpocTask error:', err);
  }
};

const removeSpocTask = async (msgId) => {
  try {
    await Task.deleteMany({ sourceType: SOURCE_TYPE, sourceId: String(msgId) });
  } catch (err) {
    console.error('removeSpocTask error:', err);
  }
};

// One pass per process: SPOC tasks created before this sync existed get their
// calendar entry. Cheap after the first run — it only inserts what is missing.
let backfilled = null;
const backfillSpocTasks = () => {
  if (!backfilled) {
    backfilled = (async () => {
      try {
        const ClientMessage = require('../models/ClientMessage');
        const have = new Set(await Task.distinct('sourceId', { sourceType: SOURCE_TYPE }));
        const missing = await ClientMessage.find({ taskType: 'spoc' }).lean();
        const docs = missing.filter((m) => !have.has(String(m._id))).map(taskFieldsFor);
        if (docs.length) await Task.insertMany(docs);
      } catch (err) {
        console.error('backfillSpocTasks error:', err);
        backfilled = null; // try again on the next request
      }
    })();
  }
  return backfilled;
};

// Tracker → Client Task: only completion flows back. updateOne skips the
// save hook, so this cannot loop.
const pushCompletion = async (task) => {
  if (task.sourceType !== SOURCE_TYPE || !task.sourceId) return;
  try {
    const ClientMessage = require('../models/ClientMessage');
    const msg = await ClientMessage.findById(task.sourceId, { status: 1 }).lean();
    if (!msg) return;
    const isDone = msg.status === 'Completed';
    if (task.completed === isDone) return;
    await ClientMessage.updateOne(
      { _id: task.sourceId },
      { $set: { status: task.completed ? 'Completed' : 'In Progress' } }
    );
  } catch (err) {
    console.error('pushCompletion error:', err);
  }
};

module.exports = { SOURCE_TYPE, syncSpocTask, removeSpocTask, backfillSpocTasks, pushCompletion };
