import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = process.env.PORT || 3000;
const { Pool } = pg;
const db = new Pool({
	connectionString: process.env.POSTGRES_URL,
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 0;

async function getUsers() {
	const result = await db.query("SELECT * FROM users;");
	return result.rows;
}

async function checkVisited(user) {
	const result = await db.query("SELECT country_code FROM visited_countries WHERE user_id = $1;", [user]);
	const color_res = await db.query("SELECT color FROM users WHERE id = $1", [user]);
	if (!color_res.rows || color_res.rows.length === 0) {
		throw Error(`No user found with id ${user}`);
	}

	const color = color_res.rows[0].color;
	let countries = [];
	result.rows.forEach((country) => {
		countries.push(country.country_code);
	});
	return { countries: countries, color: color };
}
app.get("/", async (req, res) => {
	const response = await checkVisited(currentUserId);
	const users = await getUsers();
	res.render("index.ejs", {
		countries: response.countries,
		total: response.countries.length,
		users: users,
		color: response.color,
	});
});
app.post("/update", async (req, res) => {
	const input = req.body["country"];
	try {
		const result = await db.query("SELECT * FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';", [
			input.toLowerCase(),
		]);
		let findex = 0;
		result.rows.forEach((row, index) => {
			if (row.country_name.toLowerCase() == input) {
				findex = index;
			}
		});
		const data = result.rows[findex];
		const countryCode = data.country_code;
		if (req.body.add) {
			console.log("add statement");
			try {
				await db.query("INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)", [
					countryCode,
					currentUserId,
				]);
				res.redirect("/");
			} catch (err) {
				console.log(err);
			}
		} else if (req.body.delete) {
			console.log(req.body.delete);
			console.log(countryCode, currentUserId);
			try {
				await db.query("DELETE FROM visited_countries WHERE country_code = $1 AND user_id = $2;", [
					countryCode,
					currentUserId,
				]);
				res.redirect("/");
			} catch (err) {
				console.log(err);
			}
		}
	} catch (err) {
		console.log(err);
	}
});
app.post("/user", async (req, res) => {
	if (req.body.add) {
		const users = await getUsers();
		res.render("new.ejs", {
			users: users,
		});
		console.log(users);
	} else {
		currentUserId = req.body.user;
		res.redirect("/");
	}
});
app.get("/user", async (req, res) => {
	const users = await getUsers();
	res.render("new.ejs", {
		users: users,
	});
});
app.post("/new", async (req, res) => {
	const newUser = req.body;
	const data = await db.query("INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;", [
		newUser.name,
		newUser.color,
	]);
	currentUserId = data.rows[0].id;
	res.redirect("/");
});
app.post("/delete", async (req, res) => {
	const userId = req.body.id;
	try {
		await db.query("DELETE FROM users WHERE id = $1;", [userId]);
		const users = await db.query("SELECT id FROM users ORDER BY id ASC LIMIT 1;");
		const firstUserId = users.rows[0].id;
		const response = await checkVisited(firstUserId);
		currentUserId = firstUserId;
		res.redirect("/");
	} catch (err) {
		console.log(err);
	}
});
app.post("/user/:id", (req, res) => {
	let sql = "UPDATE users SET name = $1 WHERE id = $2";
	let data = [req.body.newName, req.params.id];

	db.query(sql, data, (err, result) => {
		if (err) {
			res.status(500).send(err);
		} else {
			res.redirect("/user");
		}
	});
});

app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});
