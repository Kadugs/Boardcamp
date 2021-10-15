import express from 'express';
import cors from 'cors';
import pg from 'pg';

const{ Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json());


const connection = new Pool ({
    user: 'bootcamp_role',
    password: 'senha_super_hiper_ultra_secreta_do_role_do_bootcamp',
    host: 'localhost',
    port: 5432,
    database: 'boardcamp'
});
const getCategories = () => connection.query('SELECT * FROM categories');
const getGames = () => connection.query('SELECT * FROM games');

async function verifyGame(game) {
    const categories = await getCategories();
    const haveCategoryId = categories.rows.some(category => category.id === game.categoryId);
    console.log(haveCategoryId);
    if(game.name.length === 0 || game.stockTotal <= 0 || game.pricePerDay <= 0 || 
        !haveCategoryId || game.name === undefined || game.image === undefined || 
        game.stockTotal === undefined || game.pricePerDay === undefined || game.categoryId === undefined) {
            return true;
        }
    return false;
}

app.get('/categories', (req, res) => {
    getCategories().then(result => {
        res.send(result.rows);
     })
});

app.post('/categories', (req, res) => {
    const newCategory = req.body.name;

    getCategories().then(result => {
        if(result.rows.some( obj => obj.name === newCategory)) {
            res.sendStatus(409);
        }
    });

    if(newCategory === undefined || newCategory.length === 0) {
        res.sendStatus(400);
    }
   
    connection.query('INSERT INTO categories (name) VALUES ($1);', [newCategory])
     .then(() => {
         res.sendStatus(201)
     })
});

app.get('/games', async (req, res) => {
    
        const gameList = await getGames();
        const categories = await getCategories();
    let games = gameList.rows.map(game => {
        const category = categories.rows.find(category => {
            if(category.id === game.categoryId) return true;
        });
        return { ...game, 
            categoryName: category.name,
        }
    })
    res.send(games);
});

app.post('/games', async (req, res) => {
    const game = req.body;
    const {name, image, stockTotal, categoryId, pricePerDay} = game;
    const isVerified = await verifyGame(game);
    if(isVerified) {
        res.sendStatus(400);
    }
    const games = await getGames();
    if(games.rows.some( registredGame => registredGame.name === name)) {
        res.sendStatus(409);
    }
    connection.query('INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5);', 
        [name, image, stockTotal, categoryId, pricePerDay])
        .then(() => {
            res.sendStatus(201);
        });
})
app.listen(4000);