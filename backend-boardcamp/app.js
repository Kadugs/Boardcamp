import express from 'express';
import cors from 'cors';
import pg from 'pg';
import joi from 'joi';

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
const getCustomers = () => connection.query('SELECT * FROM customers');

async function verifyGame(game) {
    const categories = await getCategories();
    const games = await getGames();
    const haveSameNameGame = games.rows.some(item => item.name === game.name);
    const haveCategoryId = categories.rows.some(category => category.id === game.categoryId);
    if(!haveCategoryId) {
        return 400;
    }
    if(haveSameNameGame) {
        return 409;
    }
    const userSchema = joi.object({
        name: joi.string().alphanum().min(1).required(),
        image: joi.string().required(),
        stockTotal: joi.number().integer().min(1).required(),
        categoryId: joi.number().integer().min(1).required(),
        pricePerDay: joi.number().min(1).required(),
    });
    const validate = userSchema.validate(game);
    if(validate.error === undefined && (game.image.includes('https://') || game.image.includes('http://') || game.image.includes('.com'))) {
        return 201;
    }
    return 400;
}

const customerSchema = joi.object({
    name: joi.string().min(1).required(), 
    phone: joi.string().min(10).max(11).required(), 
    cpf: joi.string().min(11).max(11).required(), 
    birthday: joi.string().min(10).max(10).required(),
});
async function verifyNewCustomer(customer) {
    const validate = customerSchema.validate(customer);
    const isPhoneNumber = Number(customer.phone) !== NaN;
    const isCpf = Number(customer.cpf) !== NaN;
    const isDate = new Date(customer.birthday) !== "Invalid Date" && !isNaN(new Date(customer.birthday));
    const isARepeatedCpf = (await getCustomers()).rows.some(cust => cust.cpf === customer.cpf);
    if(isARepeatedCpf) return 409;
    if(validate.error === undefined && isPhoneNumber && isCpf && isDate) return 201;
    return 400;
}

async function verifyUpdateCustomer(customer, id) {
    const validate = customerSchema.validate(customer);
    const isPhoneNumber = Number(customer.phone) !== NaN;
    const isCpf = Number(customer.cpf) !== NaN;
    const isDate = new Date(customer.birthday) !== "Invalid Date" && !isNaN(new Date(customer.birthday));
    const isARepeatedCpf = (await getCustomers()).rows.some(cust => cust.cpf === customer.cpf && Number(cust.id) !== Number(id));
    if(isARepeatedCpf) return 409;
    if(validate.error === undefined && isPhoneNumber && isCpf && isDate) return 200;
    return 400;

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
    const games = gameList.rows.map(game => {
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
    const verified = await verifyGame(game);
    if(verified !== 201) {
        res.sendStatus(verified);
        return;
    }
    try {

        await connection.query('INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5);', 
        [name, image, stockTotal, categoryId, pricePerDay])
            res.sendStatus(verified);
    } catch (err) {
        res.sendStatus(err);
    }
});

app.get('/customers', async (req, res) => {
    try {
        const { cpf } = req.query;
        if(cpf === null || cpf === undefined || cpf.length === 0) {
            const customersList = await getCustomers();
            res.send(customersList.rows);
            return;
        }
        const filteredCustomers = await connection.query(`SELECT * FROM customers WHERE cpf LIKE '${cpf}%';`);
        res.send(filteredCustomers.rows);
    } catch {
        res.sendStatus(400);
    }
});
app.get('/customers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const customer = await connection.query(`SELECT * FROM customers WHERE id = $1`, [id]);
        if(customer.rows.length > 0) {
            res.send(customer.rows[0]);
        } else {
            res.sendStatus(404);
        }
    } catch {
        res.sendStatus(400);
    }
});
app.post('/customers', async (req, res) => {
    const newCustomer = req.body;
    const {name, phone, cpf, birthday} = newCustomer;
    try {
        const verified = await verifyNewCustomer(newCustomer);
    if(verified !== 201) {
        res.sendStatus(verified);
        return;
    }
        await connection.query('INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4)', [name, phone, cpf, birthday]);
        res.sendStatus(201);
    } catch {
        res.sendStatus(400);
    }
});
app.put('/customers/:id', async (req, res) => {
    const updateCustomer = req.body;
    const {name, phone, cpf, birthday} = updateCustomer;
    const { id } = req.params;
    try {
        const verified = await verifyUpdateCustomer(updateCustomer, id);
        if(verified !== 200) {
            res.sendStatus(verified);
        }
        await connection.query(`
            UPDATE customers 
                SET name = $1, 
                    phone = $2, 
                    cpf = $3, 
                    birthday = $4 
                WHERE id = $5`,[name, phone, cpf, birthday, id]);
        res.sendStatus(200);
    } catch {
        res.sendStatus(400);
    }
});

app.listen(4000);