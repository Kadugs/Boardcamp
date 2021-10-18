import express from 'express';
import cors from 'cors';
import pg from 'pg';
import joi from 'joi';
import dayjs from 'dayjs';

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
const getRentals = () => connection.query('SELECT rentals.* FROM rentals');
 
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
        image: joi.string().pattern(/(http(s?):)([/|.|\w|\s|-])*.(?:jpg|gif|png)/).required(),
        stockTotal: joi.number().integer().min(1).required(),
        categoryId: joi.number().integer().min(1).required(),
        pricePerDay: joi.number().min(1).required(),
    });
    const validate = userSchema.validate(game);
    if(validate.error === undefined && (game.image.includes('https://') || game.image.includes('http://'))) {
        return 201;
    }
    return 400;
}
const customerSchema = joi.object({
    name: joi.string().min(1).required(), 
    phone: joi.string().min(10).max(11).required(), 
    cpf: joi.string().min(11).max(11).pattern(/^[0-9]+$/).length(11).required(), 
    birthday: joi.string().min(10).max(10).required(),
});
async function verifyNewCustomer(customer) {
    const validate = customerSchema.validate(customer);
    const isPhoneNumber = Number(customer.phone) !== NaN;
    const isCpf = Number(customer.cpf) !== NaN;
    const birthday = dayjs(customer.birthday).format('YYYY-MM-DD')
    const isDate = birthday != "Invalid Date" && dayjs(birthday) < dayjs();
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
async function addInfos(object) {
    const customers = await getCustomers();
    const games = await getGames();
    const categories = await getCategories();
    
    return object.map(rental => {
        const customer = customers.rows.find(customer => customer.id === rental.customerId);
        const game = games.rows.find(game => game.id === rental.gameId);
        const category = categories.rows.find(category => category.id === game.categoryId);
        return {
            ...rental,
            customer: {
                id: customer.id,
                name: customer.name,
            },
            game: {
                id: game.id,
                name: game.name,
                categoryId: game.categoryId,
                categoruName: category.name,
            }
        }
    })
}

//categories
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
//games
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
//customers
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
//rentals
app.get('/rentals', async (req, res) => {
    try {
        const { customerId, gameId } = req.query;
        const gamesList = await getGames();
        const customersList = await getCustomers();
        let rentalsList;
        if(customerId === undefined && gameId === undefined) {
            rentalsList = await getRentals();
        }
        if(gameId !== undefined) {
            if(!gamesList.rows.some(game => game.id == gameId)) {
                res.sendStatus(404);
                return;
            }
            rentalsList = await connection.query(`SELECT rentals.* FROM rentals WHERE "gameId" = $1;`, [gameId]);
        }
        if(customerId !== undefined) {
            if(!customersList.rows.some(customer => customer.id == customerId)) {
                res.sendStatus(404);
                return;
            }
            rentalsList = await connection.query(`SELECT rentals.* FROM rentals WHERE "customerId" = $1;`, [customerId]);
        }
            const completeRentalsList = await addInfos(rentalsList.rows);
            res.send(completeRentalsList);
    } catch {
        res.sendStatus(400);
    }
})
app.post('/rentals', async (req, res) => {
    try {
        const customersIds = await connection.query(`SELECT (id) FROM customers`);
        const games = await getGames();
        const {customerId, gameId, daysRented} = req.body;
        const isCustomerIdValid = customersIds.rows.some(customer => customer.id== customerId);
        const gameInfo = games.rows.find(game => game.id == gameId);
        const rentalsList = await getRentals();
        const isGameAvailable = rentalsList.rows.filter(rental => rental.gameId == gameId).length < Number(gameInfo.stockTotal);
        if(!isCustomerIdValid || gameInfo === undefined || Number(daysRented) <= 0 || !isGameAvailable) {
            res.sendStatus(400);
            return;
        }
        
        const pricePerDay = await connection.query(`SELECT ("pricePerDay") FROM games WHERE id = $1;`, [gameId]);
        const rentDate = dayjs().format('YYYY-MM-DD');
        const originalPrice = pricePerDay.rows[0].pricePerDay * daysRented;
        await connection.query(`
            INSERT 
                INTO rentals 
                    ("customerId", "gameId", "daysRented", "rentDate", "originalPrice", "returnDate", "delayFee") 
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7)` 
            , [customerId, gameId, daysRented, rentDate, originalPrice, null, null]);
        res.sendStatus(201);

    } catch {
        res.sendStatus(400);
    }
})

app.post('/rentals/:id/return', async (req, res) => {
    try {
        const {id} = req.params;
        const rentals = await getRentals();
        const games = await getGames();
        const rental = rentals.rows.find(rental => rental.id == id);
        const gameInfo = games.rows.find(game => game.id == rental.gameId);
        if(rental === undefined) {
            res.sendStatus(404);
            return;
        }
        if(rental.returnDate !== null) {
            res.sendStatus(400);
            return;
        }
        const limitDay = dayjs(rental.rentDate).add(rental.daysRented, 'day');
        if(dayjs() > dayjs(limitDay)) {
            const extraDays = Number(dayjs(limitDay).subtract(dayjs()).format('DD')); 
            const fee = extraDays * Number(gameInfo.pricePerDay);
            await connection.query(`UPDATE rentals SET "delayFee" = $1 "returnDate" = $1 WHERE id = $2`, [fee, dayjs().format('YYYY-MM-DD'), id])
            res.sendStatus(200)
            return;
        }
        await connection.query(`UPDATE rentals SET "returnDate" = $1 WHERE id = $2`, [dayjs().format('YYYY-MM-DD'), id])
        res.sendStatus(200)
    } catch {
        res.sendStatus(400);
    }
})

app.delete('/rentals/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rentals = await getRentals();
        const rental = rentals.rows.find(rental => rental.id == id);
        if(rental === undefined) {
            res.sendStatus(404);
            return;
        }
        if(rental.returnDate !== null) {
            res.sendStatus(400);
        }

        await connection.query('DELETE FROM rentals WHERE id = $1', [id]);
        res.sendStatus(200);
    } catch {
        res.sendStatus(400);
    }

})

app.listen(4000);