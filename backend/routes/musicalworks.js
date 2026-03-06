const express = require('express');
const MusicalWork = require('../models/MusicalWork');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/musicalworks
router.get('/', auth, async (req, res) => {
  try {
    const works = await MusicalWork.find().sort({ createdAt: -1 });
    res.json({ works });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/musicalworks
router.post('/', auth, async (req, res) => {
  try {
    const { title, artist, album, genre, isrc, iswc, language, duration, releaseDate, publisher, territories, writers, status, spoc } = req.body;
    if (!title || !artist) return res.status(400).json({ message: 'Title and artist are required' });

    const work = new MusicalWork({
      title: title.trim(),
      artist: artist.trim(),
      album: album || '',
      genre: genre || '',
      isrc: isrc || '',
      iswc: iswc || '',
      language: language || '',
      duration: duration || '',
      releaseDate: releaseDate || '',
      publisher: publisher || '',
      territories: territories || '',
      writers: writers || '',
      status: status || 'Draft',
      spoc: spoc || '',
    });

    await work.save();
    res.status(201).json({ work });
  } catch (err) {
    console.error('Create work error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/musicalworks/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const work = await MusicalWork.findById(req.params.id);
    if (!work) return res.status(404).json({ message: 'Work not found' });

    const fields = ['title', 'artist', 'album', 'genre', 'isrc', 'iswc', 'language', 'duration', 'releaseDate', 'publisher', 'territories', 'writers', 'status', 'spoc'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) work[f] = req.body[f];
    });

    await work.save();
    res.json({ work });
  } catch (err) {
    console.error('Update work error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/musicalworks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const work = await MusicalWork.findByIdAndDelete(req.params.id);
    if (!work) return res.status(404).json({ message: 'Work not found' });
    res.json({ message: 'Work deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/musicalworks/:id/subtasks
router.post('/:id/subtasks', auth, async (req, res) => {
  try {
    const work = await MusicalWork.findById(req.params.id);
    if (!work) return res.status(404).json({ message: 'Work not found' });

    work.subTasks.push({ text: req.body.text, assignee: req.body.assignee || '', done: false });
    await work.save();
    res.json({ work });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/musicalworks/:id/subtasks/:taskId
router.put('/:id/subtasks/:taskId', auth, async (req, res) => {
  try {
    const work = await MusicalWork.findById(req.params.id);
    if (!work) return res.status(404).json({ message: 'Work not found' });

    const task = work.subTasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.body.done !== undefined) task.done = req.body.done;
    if (req.body.text !== undefined) task.text = req.body.text;
    if (req.body.assignee !== undefined) task.assignee = req.body.assignee;

    await work.save();
    res.json({ work });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
