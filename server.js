const express = require("express");
const Database = require("better-sqlite3");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");


// ========================================
// Basic settings
// ========================================

const app = express();

const PORT = 3000;


// ========================================
// Connect SQLite DB
// ========================================

const db = new Database("likes.db");


// ========================================
// Middleware
// ========================================

app.use(express.json());


// Session settings
app.use(
    session({

        secret: "my-secret-key",

        resave: false,

        saveUninitialized: false,

        cookie: {

            httpOnly: true,

            maxAge: 1000 * 60 * 60

        }

    })
);


// public/HTML

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ========================================
// users table
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        name TEXT NOT NULL,

        username TEXT UNIQUE NOT NULL,

        password TEXT NOT NULL

    )
`).run();


// ========================================
// posts table
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS posts (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        title TEXT NOT NULL

    )
`).run();


// ========================================
// likes table
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS likes (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,

        post_id INTEGER NOT NULL,

        UNIQUE(user_id, post_id),

        FOREIGN KEY(user_id)
            REFERENCES users(id),

        FOREIGN KEY(post_id)
            REFERENCES posts(id)

    )
`).run();


// ========================================
// Create test post
// ========================================

const postCount = db
    .prepare(`
        SELECT COUNT(*) AS count
        FROM posts
    `)
    .get();


if (postCount.count === 0) {

    db.prepare(`
        INSERT INTO posts (title)
        VALUES (?)
    `)
    .run("맛있는 피자");

}


// ========================================
// Sign up
// ========================================

app.post(
    "/api/register",
    (req, res) => {

        const {
            name,
            username,
            password
        } = req.body;


        // Confirm values

        if (
            !name ||
            !username ||
            !password
        ) {

            return res.status(400).json({

                message:
                    "Input Name, username, password."

            });

        }


        // Check for duplicate username

        const existingUser =
            db.prepare(`
                SELECT id
                FROM users
                WHERE username = ?
            `)
            .get(username);


        if (existingUser) {

            return res.status(400).json({

                message:
                    "Already in use username."

            });

        }


        // Encrypt password

        const hashedPassword =
            bcrypt.hashSync(
                password,
                10
            );


        // Save to DB

        db.prepare(`
            INSERT INTO users
            (
                name,
                username,
                password
            )

            VALUES (?, ?, ?)
        `)
        .run(
            name,
            username,
            hashedPassword
        );


        res.json({

            message:
                "Confirm signup."

        });

    }
);


// ========================================
// Login
// ========================================

app.post(
    "/api/login",
    (req, res) => {

        const {
            username,
            password
        } = req.body;


        // Confirm values

        if (
            !username ||
            !password
        ) {

            return res.status(400).json({

                message:
                    "Input username and password."

            });

        }


        // Search for user

        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    username,
                    password

                FROM users

                WHERE username = ?
            `)
            .get(username);


        if (!user) {

            return res.status(401).json({

                message:
                    "Wrong username or password."

            });

        }


        // Check password

        const passwordOK =
            bcrypt.compareSync(
                password,
                user.password
            );


        if (!passwordOK) {

            return res.status(401).json({

                message:
                    "Wrong username or password."

            });

        }


        // =================================
        // Login successful
        //
        // Save user ID to Session
        // =================================

        req.session.userId =
            user.id;


        res.json({

            id: user.id,

            name: user.name,

            username: user.username

        });

    }
);


// ========================================
// Current logged-in user verification
// ========================================

app.get(
    "/api/me",
    (req, res) => {

        // Session verification

        if (!req.session.userId) {

            return res.status(401).json({

                message:
                    "Login is required."

            });

        }


        // Serach DB by Session의 userId

        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    username

                FROM users

                WHERE id = ?
            `)
            .get(
                req.session.userId
            );


        if (!user) {

            return res.status(401).json({

                message:
                    "User not found."

            });

        }


        res.json(user);

    }
);


// ========================================
// Logout
// ========================================

app.post(
    "/api/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    return res.status(500)
                        .json({

                            message:
                                "Logout failed."

                        });

                }


                res.json({

                    message:
                        "Logged out successfully."

                });

            }
        );

    }
);


// ========================================
// Get post info
// ========================================

app.get(
    "/api/posts/:postId",
    (req, res) => {

        const postId =
            Number(req.params.postId);


        // Search for post

        const post =
            db.prepare(`
                SELECT
                    id,
                    title

                FROM posts

                WHERE id = ?
            `)
            .get(postId);


        if (!post) {

            return res.status(404).json({

                message:
                    "Post not found."

            });

        }


        // Total like count

        const count =
            db.prepare(`
                SELECT
                    COUNT(*) AS count

                FROM likes

                WHERE post_id = ?
            `)
            .get(postId);


        // Current logged-in user

        const userId =
            req.session.userId;


        let liked = false;


        // If logged in
        // Check if the user has liked the post

        if (userId) {

            const like =
                db.prepare(`
                    SELECT id

                    FROM likes

                    WHERE user_id = ?

                    AND post_id = ?
                `)
                .get(
                    userId,
                    postId
                );


            liked = !!like;

        }


        res.json({

            id: post.id,

            title: post.title,

            likeCount:
                count.count,

            liked: liked

        });

    }
);


// ========================================
// Like post
// ========================================

app.post(
    "/api/posts/:postId/like",
    (req, res) => {

        // =================================
        // Check user in Session
        // =================================

        const userId =
            req.session.userId;


        if (!userId) {

            return res.status(401).json({

                message:
                    "Like post requires login."

            });

        }


        const postId =
            Number(req.params.postId);


        // Check if post exists

        const post =
            db.prepare(`
                SELECT id

                FROM posts

                WHERE id = ?
            `)
            .get(postId);


        if (!post) {

            return res.status(404).json({

                message:
                    "Post not found."

            });

        }


        // Save like

        try {

            db.prepare(`
                INSERT INTO likes
                (
                    user_id,
                    post_id
                )

                VALUES (?, ?)
            `)
            .run(
                userId,
                postId
            );

        }

        catch (error) {

            // if the user has already liked the post, return an error

            if (
                error.code ===
                "SQLITE_CONSTRAINT_UNIQUE"
            ) {

                return res.status(400).json({

                    message:
                        "You have already liked this post."

                });

            }


            throw error;

        }


        // Calculate like count again

        const count =
            db.prepare(`
                SELECT
                    COUNT(*) AS count

                FROM likes

                WHERE post_id = ?
            `)
            .get(postId);


        res.json({

            liked: true,

            likeCount:
                count.count

        });

    }
);


// ========================================
// Like and Cancel
// ========================================

app.delete(
    "/api/posts/:postId/like",
    (req, res) => {

        // Check user in Session

        const userId =
            req.session.userId;


        if (!userId) {

            return res.status(401).json({

                message:
                    "Please login first."

            });

        }


        const postId =
            Number(req.params.postId);


        // Delete like in DB

        db.prepare(`
            DELETE FROM likes

            WHERE user_id = ?

            AND post_id = ?
        `)
        .run(
            userId,
            postId
        );


        // Calculate like count again

        const count =
            db.prepare(`
                SELECT
                    COUNT(*) AS count

                FROM likes

                WHERE post_id = ?
            `)
            .get(postId);


        res.json({

            liked: false,

            likeCount:
                count.count

        });

    }
);


// ========================================
// Server execution
// ========================================

app.listen(
    PORT,
    () => {

        console.log(
            `Server running at http://localhost:${PORT}`
        );

    }
);