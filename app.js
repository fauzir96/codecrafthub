const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 5000;

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Path to our JSON database file
const dataFilePath = path.join(__dirname, 'courses.json');

// ---------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------

/**
 * Initializes the database file. 
 * If courses.json doesn't exist, it creates it with an empty array.
 */
async function initDB() {
    try {
        await fs.access(dataFilePath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('courses.json not found. Creating a new one...');
            await fs.writeFile(dataFilePath, JSON.stringify([], null, 2));
        } else {
            console.error('Error accessing database file:', error);
        }
    }
}

/**
 * Reads and parses the courses from the JSON file.
 */
async function readCourses() {
    try {
        const data = await fs.readFile(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        throw new Error('Failed to read database file.');
    }
}

/**
 * Writes the courses array back to the JSON file.
 */
async function writeCourses(courses) {
    try {
        await fs.writeFile(dataFilePath, JSON.stringify(courses, null, 2));
    } catch (error) {
        throw new Error('Failed to write to database file.');
    }
}

/**
 * Validates incoming course data based on requirements.
 */
function validateCourseData(data) {
    const errors = [];
    const { name, description, target_date, status } = data;

    if (!name) errors.push('Name is required.');
    if (!description) errors.push('Description is required.');
    
    // Validate Date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!target_date || !dateRegex.test(target_date)) {
        errors.push('Target date is required and must be in YYYY-MM-DD format.');
    }

    // Validate Status Enum
    const validStatuses = ['Not Started', 'In Progress', 'Completed'];
    if (!status || !validStatuses.includes(status)) {
        errors.push(`Status is required and must be one of: ${validStatuses.join(', ')}.`);
    }

    return errors;
}

// ---------------------------------------------------------
// REST API ENDPOINTS
// ---------------------------------------------------------

// 1. CREATE: Add a new course
app.post('/api/courses', async (req, res) => {
    try {
        const validationErrors = validateCourseData(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
        }

        const courses = await readCourses();

        // Auto-generate ID starting from 1
        const newId = courses.length > 0 ? Math.max(...courses.map(c => c.id)) + 1 : 1;

        const newCourse = {
            id: newId,
            name: req.body.name,
            description: req.body.description,
            target_date: req.body.target_date,
            status: req.body.status,
            created_at: new Date().toISOString()
        };

        courses.push(newCourse);
        await writeCourses(courses);

        res.status(201).json(newCourse);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =========================================================
// BONUS CHALLENGE: Get course statistics
// =========================================================
app.get('/api/courses/stats', async (req, res) => {
    try {
        // 1. Membaca seluruh data kursus yang ada dari file JSON
        const courses = await readCourses();

        // 2. Menghitung total semua kursus
        const totalCourses = courses.length;

        // 3. Menghitung jumlah kursus berdasarkan masing-masing status
        // Kita menggunakan metode .filter() untuk menyaring data yang cocok, lalu mengambil .length-nya
        const notStartedCount = courses.filter(c => c.status === 'Not Started').length;
        const inProgressCount = courses.filter(c => c.status === 'In Progress').length;
        const completedCount = courses.filter(c => c.status === 'Completed').length;

        // 4. Mengirimkan objek JSON berisi statistik lengkap ke client
        res.status(200).json({
            total_courses: totalCourses,
            by_status: {
                not_started: notStartedCount,
                in_progress: inProgressCount,
                completed: completedCount
            }
        });
    } catch (error) {
        // Menangani jika terjadi error saat membaca file database
        res.status(500).json({ error: error.message });
    }
});

// 2. READ: Get all courses
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await readCourses();
        res.status(200).json(courses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. READ: Get a specific course by ID
app.get('/api/courses/:id', async (req, res) => {
    try {
        const courses = await readCourses();
        const courseId = parseInt(req.params.id, 10);
        
        const course = courses.find(c => c.id === courseId);
        
        if (!course) {
            return res.status(404).json({ error: 'Course not found.' });
        }
        
        res.status(200).json(course);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. UPDATE: Modify an existing course
app.put('/api/courses/:id', async (req, res) => {
    try {
        const validationErrors = validateCourseData(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
        }

        const courses = await readCourses();
        const courseId = parseInt(req.params.id, 10);
        
        const courseIndex = courses.findIndex(c => c.id === courseId);
        
        if (courseIndex === -1) {
            return res.status(404).json({ error: 'Course not found.' });
        }

        // Update the course while preserving its id and created_at
        courses[courseIndex] = {
            ...courses[courseIndex], // Spread operator keeps existing fields
            name: req.body.name,
            description: req.body.description,
            target_date: req.body.target_date,
            status: req.body.status
            // We do not update created_at or id
        };

        await writeCourses(courses);
        res.status(200).json(courses[courseIndex]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. DELETE: Remove a course
app.delete('/api/courses/:id', async (req, res) => {
    try {
        const courses = await readCourses();
        const courseId = parseInt(req.params.id, 10);
        
        const courseIndex = courses.findIndex(c => c.id === courseId);
        
        if (courseIndex === -1) {
            return res.status(404).json({ error: 'Course not found.' });
        }

        // Remove 1 item at the found index
        const deletedCourse = courses.splice(courseIndex, 1);
        await writeCourses(courses);
        
        res.status(200).json({ 
            message: 'Course deleted successfully.', 
            course: deletedCourse[0] 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------
// SERVER START
// ---------------------------------------------------------

// Initialize the DB file first, then start listening for requests
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`CodeCraftHub server is running on http://localhost:${PORT}`);
    });
});