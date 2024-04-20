if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}

const express = require('express');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const { isLoggedIn } = require('./middleware');
const { storeReturnTo } = require('./middleware');
const Campground = require('./models/campground');
const Review = require('./models/review');
const User = require('./models/user');
const cities = require('./seeds/cities');
const { descriptors, places, descriptions } = require('./seeds/seedHelpers');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const multer = require('multer');
const { storage, cloudinary } = require('./cloudinaryConfig');
const upload = multer({ storage });
const mongoSanitize = require('express-mongo-sanitize');
const MongoStore = require('connect-mongo')(session);

const app = express();
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.use(methodOverride('_method'));
app.use(express.static('public'));
app.use(mongoSanitize());

// const dbUrl = process.env.DB_URL;
mongoose.connect('mongodb://localhost:27017/YelpCamp')
    .then(() => {
        console.log('Express App Successfully Connected with MongoDB');
    })
    .catch(() => {
        console.log("Couldn't Establish Connection between Express App and MongoDB");
    })

const store = new MongoStore({
    url: 'mongodb://localhost:27017/YelpCamp',
    secret: 'thisshouldbeabettersecret!',
    touchAfter: 24 * 60 * 60
});

const sessionConfig = {
    store,
    secret: 'thisshouldbeabettersecret!',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
};

app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.success = req.flash('success');
    res.locals.danger = req.flash('danger');
    res.locals.error = req.flash('error');
    if (req.originalUrl != "/login") {
        delete req.session.returnTo;
    }
    next();
});

// Home
app.get('/', async (req, res) => {
    res.locals.title = 'NatureTrails';
    res.render('home');
});

// Index
app.get('/campgrounds', async (req, res) => {
    res.locals.title = 'Campgrounds';
    const campgrounds = await Campground.find({});
    res.render('index', { campgrounds });
});

// New
app.get('/campgrounds/new', isLoggedIn, (req, res) => {
    res.locals.title = 'Adding New Campground';
    res.render('new', { cities, descriptors, places, descriptions });
});
app.use(express.urlencoded({ extended: true }));
app.post('/campgrounds', upload.array('image'), async (req, res) => {
    try {
        const geoData = await geocoder.forwardGeocode({
            query: req.body.location,
            limit: 1
        }).send();
        const { title, location, price, description } = req.body;
        const campground = new Campground({ title, location, price, description });
        campground.geometry = geoData.body.features[0].geometry;
        campground.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
        campground.author = req.user._id;
        await campground.save();
        req.flash('success', 'New Campground Added');
        res.redirect(`/campgrounds/${campground._id}`);
    } catch (e) {
        req.flash('danger', 'Invalid Location');
        res.redirect('/campgrounds/new');
    }
});

// Show
app.get('/campgrounds/:id', (req, res, next) => {
    const { id } = req.params;
    Campground.findById(id).populate({ path: 'reviews', populate: { path: 'author' } }).populate('author')
        .then((data) => {
            const campground = data;
            res.locals.title = campground.title;
            res.render('show', { campground });
        })
        .catch(() => {
            next();
        })
});

// Edit
app.get('/campgrounds/:id/edit', isLoggedIn, (req, res, next) => {
    const { id } = req.params;
    Campground.findById(id)
        .then((campground) => {
            if (!campground.author.equals(req.user._id)) {
                req.flash('error', 'You do not have permission to do that');
                res.redirect(`/campgrounds/${id}`);
            } else {
                res.locals.title = `Editting - ${campground.title}`;
                res.render('edit', { campground, cities, descriptors, places, descriptions });
            }
        })
        .catch(() => {
            next();
        })
});
app.post('/campgrounds/:id', upload.array('image'), async (req, res) => {
    try {
        const geoData = await geocoder.forwardGeocode({
            query: req.body.location,
            limit: 1
        }).send();
        const { id } = req.params;
        const { title, location, price, description } = req.body;
        const campground = await Campground.findByIdAndUpdate({ _id: id }, { title, location, price, description });
        const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }));
        campground.images.push(...imgs);
        campground.geometry = geoData.body.features[0].geometry;
        await campground.save();
        if (req.body.deleteImages) {
            for (let filename of req.body.deleteImages) {
                await cloudinary.uploader.destroy(filename);
            }
            await campground.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } });
        }
        req.flash('success', 'Campground Information Updated');
        res.redirect(`/campgrounds/${id}`);
    } catch (e) {
        req.flash('danger', 'Invalid Location');
        res.redirect(`/campgrounds/${req.params.id}/edit`);
    }
});

// Delete
app.get('/campgrounds/:id/delete', isLoggedIn, (req, res, next) => {
    const { id } = req.params;
    Campground.findById(id)
        .then((campground) => {
            if (!campground.author.equals(req.user._id)) {
                req.flash('error', 'You do not have permission to do that');
                res.redirect(`/campgrounds/${id}`);
            } else {
                res.locals.title = 'Delete';
                res.render('delete', { id });
            }
        })
        .catch(() => {
            next();
        })
});
app.delete('/campgrounds/:id', async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findByIdAndDelete(id);
    for (let img of campground.images) {
        await cloudinary.uploader.destroy(img.filename);
    }
    req.flash('danger', `${campground.title} Deleted`);
    res.redirect('/campgrounds');
});

// Reviews
app.post('/campgrounds/:id/reviews', async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findById(id);
    const { rating, body } = req.body;
    const review = new Review({ rating, body });
    review.author = req.user._id;
    campground.reviews.push(review);
    await review.save();
    await campground.save();
    req.flash('success', 'Review Posted');
    res.redirect(`/campgrounds/${campground._id}`);
});
app.delete('/campgrounds/:id/reviews/:reviewId', async (req, res) => {
    const { id, reviewId } = req.params;
    await Campground.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    req.flash('danger', 'Review Deleted');
    res.redirect(`/campgrounds/${id}`);
});

// Register
app.get('/register', (req, res) => {
    res.locals.title = 'Register';
    res.render('register');
});
app.post('/register', async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err)
                next(err);
            else {
                req.flash('success', `Welcome to NatureTrails, ${req.user.username}`);
                res.redirect('/campgrounds');
            }
        });
    } catch (e) {
        req.flash('danger', e.message);
        res.redirect('/register');
    }
});

// Login
app.get('/login', (req, res) => {
    res.locals.title = 'Login';
    res.render('login');
});
app.post('/login', storeReturnTo, passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), (req, res) => {
    req.flash('success', `Welcome Back, ${req.user.username}`);
    const redirectUrl = res.locals.returnTo || '/campgrounds';
    res.redirect(redirectUrl);
});

// Logout
app.get('/logout', (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.flash('success', 'You are signed out');
        res.redirect('/campgrounds');
    });
});

app.use((req, res) => {
    res.locals.title = 'Error 404';
    res.status(404).render('error');
});

app.listen(3000, () => {
    console.log('Listening on Port 3000');
});