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
// users 테이블
// ======================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    )
`).run();


// ======================================
// posts 테이블
// ======================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL
    )
`).run();


// ======================================
// likes 테이블
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
// 테스트 사용자 생성
// ======================================

const userCount = db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get();

if (userCount.count === 0) {

    db.prepare(`
        INSERT INTO users (name)
        VALUES (?)
    `).run("홍길동");

    db.prepare(`
        INSERT INTO users (name)
        VALUES (?)
    `).run("김철수");

    db.prepare(`
        INSERT INTO users (name)
        VALUES (?)
    `).run("이영희");
}


// ======================================
// 테스트 게시물 생성
// ======================================

const postCount = db
    .prepare("SELECT COUNT(*) AS count FROM posts")
    .get();

if (postCount.count === 0) {

    db.prepare(`
        INSERT INTO posts (title)
        VALUES (?)
    `).run("맛있는 피자");
}


// ======================================
// HTML 제공
// ======================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ======================================
// 사용자 목록
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
// 로그인
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
            message: "사용자를 찾을 수 없습니다."
        });

    }


    // 실제 서비스에서는
    // 여기에서 Session 또는 JWT 등을 사용합니다.

    res.json({
        userId: user.id,
        name: user.name
    });

});


// ======================================
// 좋아요 개수 + 현재 사용자의 좋아요 여부
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
                message: "게시물이 없습니다."
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


        // 현재 사용자가 좋아요를 눌렀는지
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
// 좋아요
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
                        "이미 좋아요를 눌렀습니다."
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
// 좋아요 취소
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
// 서버 실행
// ======================================

app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});