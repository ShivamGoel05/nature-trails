const mongoose = require('mongoose');
const Campground = require('../models/campground');
const cities = require('./cities');
const { descriptors, places, descriptions } = require('./seedHelpers');
mongoose.connect('mongodb://localhost:27017/YelpCamp')
    .then(() => {
        console.log('Successfully Connected with MongoDB');
    })
    .catch(() => {
        console.log("Couldn't Establish Connection with MongoDB");
    })
const seedDB = async () => {
    await Campground.deleteMany({});
    for (let i = 0; i < 50; i++) {
        const rand1000 = Math.floor(Math.random() * 1000);
        const randDescriptor = Math.floor(Math.random() * descriptors.length);
        const randPlace = Math.floor(Math.random() * places.length);
        const randPrice = Math.floor(Math.random() * 21) + 15;
        const randDescription = Math.floor(Math.random() * 25);
        const camp = new Campground({
            author: '661989d40f6e8d0367bd5b89',
            title: `${descriptors[randDescriptor]} ${places[randPlace]}`,
            images: [
                {
                    url: 'https://res.cloudinary.com/dnv218rae/image/upload/v1713102967/YelpCamp/oum86efqovucuzkhf69s.jpg',
                    filename: 'YelpCamp/oum86efqovucuzkhf69s',
                },
                {
                    url: 'https://res.cloudinary.com/dnv218rae/image/upload/v1713102960/YelpCamp/ap7fzcn0kteugimjzxwl.jpg',
                    filename: 'YelpCamp/ap7fzcn0kteugimjzxwl',
                }
            ],
            price: randPrice,
            description: `${descriptions[randDescription]}`,
            location: `${cities[rand1000].city}, ${cities[rand1000].state}`,
            geometry: {
                type: 'Point',
                coordinates: [cities[rand1000].longitude, cities[rand1000].latitude]
            }
        });
        await camp.save();
    }
};
seedDB()
    .then(() => {
        mongoose.connection.close();
    })
    .catch((err) => {
        console.log(err);
    })