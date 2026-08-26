const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());


// ======================================
// SQLite DB
// ======================================

const db = new Database("likes.db");


// ======================================
// users table
// ======================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    )
`).run();


// ======================================
// posts table
// ======================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL
    )
`).run();


// ======================================
// likes table
// ======================================

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


// ======================================
// Create test users
// ======================================

const userCount = db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get();

if (userCount.count === 0) {

    db.prepare(`
        INSERT INTO users (name)
        VALUES (?)
    `).run("Tom");

    db.prepare(`
        INSERT INTO users (name)
        VALUES (?)
    `).run("Jane");

    db.prepare(`
        INSERT INTO users (name)
        VALUES (?)
    `).run("Michael");
}


// ======================================
// Create test post
// ======================================

const postCount = db
    .prepare("SELECT COUNT(*) AS count FROM posts")
    .get();

if (postCount.count === 0) {

    db.prepare(`
        INSERT INTO posts (title)
        VALUES (?)
    `).run("I like Pizza");
}


// ======================================
// HTML 
// ======================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ======================================
// User list
// ======================================

app.get("/api/users", (req, res) => {

    const users = db
        .prepare(`
            SELECT id, name
            FROM users
            ORDER BY id
        `)
        .all();

    res.json(users);
});


// ======================================
// Login
// ======================================

app.post("/api/login", (req, res) => {

    const userId = Number(req.body.userId);

    const user = db
        .prepare(`
            SELECT id, name
            FROM users
            WHERE id = ?
        `)
        .get(userId);


    if (!user) {

        return res.status(404).json({
            message: "User not found."
        });

    }


    // Use Session or JWT in a real application for authentication and authorization.

    res.json({
        userId: user.id,
        name: user.name
    });

});


// ======================================
// Number of likes and whether the user has liked the post
// ======================================

app.get(
    "/api/posts/:postId",
    (req, res) => {

        const postId =
            Number(req.params.postId);

        const userId =
            Number(req.query.userId);


        // 게시물
        const post = db
            .prepare(`
                SELECT id, title
                FROM posts
                WHERE id = ?
            `)
            .get(postId);


        if (!post) {

            return res.status(404).json({
                message: "Post not found."
            });

        }


        // 전체 좋아요 개수
        const count = db
            .prepare(`
                SELECT COUNT(*) AS count
                FROM likes
                WHERE post_id = ?
            `)
            .get(postId);


        // if user press like button
        const userLike = db
            .prepare(`
                SELECT id
                FROM likes
                WHERE user_id = ?
                AND post_id = ?
            `)
            .get(userId, postId);


        res.json({

            id: post.id,

            title: post.title,

            likeCount: count.count,

            liked: !!userLike

        });

    }
);


// ======================================
// Like
// ======================================

app.post(
    "/api/posts/:postId/like",
    (req, res) => {

        const postId =
            Number(req.params.postId);

        const userId =
            Number(req.body.userId);


        try {

            db.prepare(`
                INSERT INTO likes
                (user_id, post_id)

                VALUES (?, ?)
            `).run(userId, postId);

        }

        catch (error) {

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


        const count = db
            .prepare(`
                SELECT COUNT(*) AS count
                FROM likes
                WHERE post_id = ?
            `)
            .get(postId);


        res.json({

            liked: true,

            likeCount: count.count

        });

    }
);


// ======================================
// Like and Cancel
// ======================================

app.delete(
    "/api/posts/:postId/like",
    (req, res) => {

        const postId =
            Number(req.params.postId);

        const userId =
            Number(req.body.userId);


        db.prepare(`
            DELETE FROM likes

            WHERE user_id = ?

            AND post_id = ?
        `).run(userId, postId);


        const count = db
            .prepare(`
                SELECT COUNT(*) AS count
                FROM likes
                WHERE post_id = ?
            `)
            .get(postId);


        res.json({

            liked: false,

            likeCount: count.count

        });

    }
);


// ======================================
// Run server
// ======================================

app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});