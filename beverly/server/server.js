'use strict'

// Application dependencies
const express = require('express');
const cors = require('cors');
const pg = require('pg');
const bodyParser = require('body-parser').urlencoded({extended: true});
const superagent = require('superagent');

// Application Setup
const app = express();
const PORT = process.env.PORT;
const CLIENT_URL = process.env.CLIENT_URL;
const TOKEN = process.env.TOKEN;

// COMMENT: Explain the following line of code. What is the API_KEY? Where did it come from?
// ANSWER: The API Key is used for making API calls through the server to the Google Books API. It is made on the Google Books API Developer site when you request credentials so they can track your access to the API.
const API_KEY = process.env.GOOGLE_API_KEY;

// Database Setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// Application Middleware
app.use(cors());

// API Endpoints
app.get('/api/v1/admin', (req, res) => res.send(TOKEN === parseInt(req.query.token)));

app.get('/api/v1/books/find', (req, res) => {
  let url = 'https://www.googleapis.com/books/v1/volumes';

  // COMMENT: Explain the following four lines of code. How is the query built out? What information will be used to create the query?
  // ANSWER: The query is built out using the search parameters the user input into the search form. If the user input a search value for any of the fields, a query string will be made for that search parameter.
  let query = '';
  if(req.query.title) query += `+intitle:${req.query.title}`;
  if(req.query.author) query += `+inauthor:${req.query.author}`;
  if(req.query.isbn) query += `+isbn:${req.query.isbn}`;

  // COMMENT: What is superagent? How is it being used here? What other libraries are available that could be used for the same purpose?
  // ANSWER: Superagent is a client-side HTTP request library and Node.js module with the same API. It is being used here to send along the token as a header. Other libraries that could be used are axios and morgan.
  superagent.get(url)
    .query({'q': query})
    .query({'key': API_KEY})
    .then(response => response.body.items.map((book, idx) => {

      // COMMENT: The line below is an example of destructuring. Explain destructuring in your own words.
      // ANSWER: Destructuring is a shorthand to unpack an object; it declares all the variables at once and attaches them to the object properties.
      let { title, authors, industryIdentifiers, imageLinks, description } = book.volumeInfo;

      // COMMENT: What is the purpose of the following placeholder image?
      // ANSWER: If the search query result does not have an image for the book, the placeholder image will be used so it is not just empty or blank.
      let placeholderImage = 'http://www.newyorkpaddy.com/images/covers/NoCoverAvailable.jpg';

      // COMMENT: Explain how ternary operators are being used below.
      // ANSWER: Ternary operators are a shorthand or different way to use if/else statements. If the properties have a value then that value is the object property's value and if no value was returned then a message saying there was no value becomes that object property's value.
      return {
        title: title ? title : 'No title available',
        author: authors ? authors[0] : 'No authors available',
        isbn: industryIdentifiers ? `ISBN_13 ${industryIdentifiers[0].identifier}` : 'No ISBN available',
        image_url: imageLinks ? imageLinks.smallThumbnail : placeholderImage,
        description: description ? description : 'No description available',
        book_id: industryIdentifiers ? `${industryIdentifiers[0].identifier}` : '',
      };
    }))
    .then(arr => res.send(arr))
    .catch(console.error);
});

// COMMENT: How does this route differ from the route above? What does ':isbn' refer to in the code below?
// ANSWER: This route finds a specific book using it's isbn only and not by title or author. ':isbn' will be whatever was passed in the $.get() request after '/api/v1/books/find/', which will be the isbn for the book the user is searching for. 
app.get('/api/v1/books/find/:isbn', (req, res) => {
  let url = 'https://www.googleapis.com/books/v1/volumes';
  superagent.get(url)
    .query({ 'q': `+isbn:${req.params.isbn}`})
    .query({ 'key': API_KEY })
    .then(response => response.body.items.map((book, idx) => {
      let { title, authors, industryIdentifiers, imageLinks, description } = book.volumeInfo;
      let placeholderImage = 'http://www.newyorkpaddy.com/images/covers/NoCoverAvailable.jpg';

      return {
        title: title ? title : 'No title available',
        author: authors ? authors[0] : 'No authors available',
        isbn: industryIdentifiers ? `ISBN_13 ${industryIdentifiers[0].identifier}` : 'No ISBN available',
        image_url: imageLinks ? imageLinks.smallThumbnail : placeholderImage,
        description: description ? description : 'No description available',
      };
    }))
    .then(book => res.send(book[0]))
    .catch(console.error);
});

app.get('/api/v1/books', (req, res) => {
  client.query(`SELECT book_id, title, author, image_url, isbn FROM books;`)
    .then(results => res.send(results.rows))
    .catch(console.error);
});

app.get('/api/v1/books/:id', (req, res) => {
  client.query(`SELECT * FROM books WHERE book_id=${req.params.id}`)
    .then(results => res.send(results.rows))
    .catch(console.error);
});

app.post('/api/v1/books', bodyParser, (req, res) => {
  let {title, author, isbn, image_url, description} = req.body;
  client.query(`
    INSERT INTO books(title, author, isbn, image_url, description) VALUES($1, $2, $3, $4, $5)`,
    [title, author, isbn, image_url, description]
  )
    .then(results => res.sendStatus(201))
    .catch(console.error);
});

app.put('/api/v1/books/:id', bodyParser, (req, res) => {
  let {title, author, isbn, image_url, description} = req.body;
  client.query(`
    UPDATE books
    SET title=$1, author=$2, isbn=$3, image_url=$4, description=$5
    WHERE book_id=$6`,
    [title, author, isbn, image_url, description, req.params.id]
  )
    .then(() => res.sendStatus(204))
    .catch(console.error);
});

app.delete('/api/v1/books/:id', (req, res) => {
  client.query('DELETE FROM books WHERE book_id=$1', [req.params.id])
    .then(() => res.sendStatus(204))
    .catch(console.error);
});

app.get('*', (req, res) => res.redirect(CLIENT_URL));
app.listen(PORT, () => console.log(`Listening on port: ${PORT}`));