const mongoose = require('mongoose');
const ReviewSchema = new mongoose.Schema({
    body: String,
    rating: Number,
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});
const Review = mongoose.model('Review', ReviewSchema);
module.exports = Review;