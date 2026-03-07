const mongoose = require('mongoose');

const subTaskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  assignee: { type: String, default: '' },
  done: { type: Boolean, default: false },
});

const musicalWorkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    album: { type: String, default: '' },
    genre: { type: String, default: '' },
    isrc: { type: String, default: '' },
    iswc: { type: String, default: '' },
    language: { type: String, default: '' },
    duration: { type: String, default: '' },
    releaseDate: { type: String, default: '' },
    publisher: { type: String, default: '' },
    territories: { type: String, default: '' },
    writers: { type: String, default: '' },
    status: { type: String, default: 'Draft', enum: ['Draft', 'Pending Review', 'Registered'] },
    spoc: { type: String, default: '' },
    assignedDate: { type: Date, default: null },
    deadline: { type: Date, default: null },
    subTasks: [subTaskSchema],
  },
  { timestamps: true, collection: 'musical_works' }
);

module.exports = mongoose.model('MusicalWork', musicalWorkSchema);
