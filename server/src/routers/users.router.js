const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authenticateToken = require("../middleware/authMiddleware.middleware");
const Users = require("../models/users.model");
const UserProfiles = require("../models/userProfiles.model");
const sequelize = require("../connection");

// Cosultar todos los usuarios
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [result] = await sequelize.query("select * from vShowUsers;");

    if (result.length === 0) {
      res.status(409).json({
        ok: false,
        status: 409,
        message: "empty",
      });
    }

    res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: "Error fething user data",
    });
  }
});

// Iniciar sesión
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      message: "Email and password are required",
    });
  }

  try {
    const users = await Users.findOne({ where: { email } });

    if (!users) {
      return res.status(400).json({
        ok: false,
        message: "Invalid email or password",
      });
    }

    //const isPasswordValid = await bcrypt.compare(password, users.password_hash);
    const isPasswordValid = password === users.password_hash;
    if (!isPasswordValid) {
      return res.status(400).json({
        ok: false,
        message: "Invalid email or password",
      });
    }

    // Crear token JWT
    const token = jwt.sign({ id: users.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.status(200).json({
      ok: true,
      message: "Login successful",
      token,
      users: {
        id: users.id,
        email: users.email,
        username: users.username,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error logging in",
      error: error.message,
    });
  }
});

// Buscar usuario
router.get("/find/", authenticateToken, async (req, res) => {
  const { id, email, student_id, phone_number } = req.query;

  try {
    const replacements = {
      user_id: id || null,
      email: email || null,
      student_id: student_id || null,
      phone_number: phone_number || null,
    };

    const [result] = await sequelize.query(
      "call spSearchUser(:user_id,:email,:student_id,:phone_number);",
      { replacements }
    );

    if (!result || result.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "No users found",
      });
    }

    res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: "Error",
    });
  }
});

// Consultar detalles del usuario
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await sequelize.query("call spUserDetails(:user_id);", {
      replacements: { user_id: id },
    });

    if (!result) {
      res.status(409).json({
        ok: false,
        status: 409,
        message: "empty",
      });
    }

    res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: "Error fetching user data",
    });
  }
});

// Registro de usuario
router.post("/register", authenticateToken, async (req, res) => {
  const {
    email,
    password_hash,
    rol_id,
    student_id,
    first_name,
    last_name,
    phone_number,
  } = req.body;

  const transaction = await sequelize.transaction();

  try {
    const existingEmail = await Users.findOne({ where: { email } });

    /// Validar que el correo electronico no este registrado
    if (existingEmail) {
      return res.status(400).json({
        ok: false,
        message: "Email already exists",
      });
    }

    const existingStudentId = await UserProfiles.findOne({
      where: { student_id },
    });

    // Validar que matricula no este registrada
    if (existingStudentId) {
      return res.status(400).json({
        ok: false,
        message: "Student id already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password_hash, 10);

    const newUser = await Users.create(
      { email, password_hash: hashedPassword, rol_id },
      { transaction }
    );

    await UserProfiles.create(
      { user_id: newUser.id, student_id, first_name, last_name, phone_number },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      message: "User created successfully",
      user_id: newUser.id,
    });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({
      message: "Error",
      error: err.message,
      stack: err.stack,
    });
  }
});

// Actualizar usuario
router.put("/update/:iduser", authenticateToken, async (req, res) => {
  const { iduser } = req.params;
  const { email, student_id, userRol, firstName, lastName, phoneNumber } =
    req.body;

  try {
    const user = await Users.findByPk(iduser, {
      include: [UserProfiles],
    });

    if (!user) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const userData = {};
    if (email) userData.email = email;
    if (userRol) userData.rol_id = userRol;

    const profileData = {};
    if (student_id) profileData.student_id = student_id;
    if (firstName) profileData.first_name = firstName;
    if (lastName) profileData.last_name = lastName;
    if (phoneNumber) profileData.phone_number = phoneNumber;

    if (Object.keys(userData).length > 0) {
      await user.update(userData);
    }

    if (Object.keys(profileData).length > 0 && user.UserProfile) {
      await user.UserProfile.update(profileData);
    }

    res.json({ ok: true, message: "Usuario actualizado exitosamente" });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: "Error actualizando el usuario",
    });
  }
});

// Desactivar usuario (baja logica)
router.put("/deactivate/:idUser", authenticateToken, async (req, res) => {
  const { idUser } = req.params;
  const { param } = req.body;

  if (!param) {
    return res.status(400).json({
      ok: false,
      message: "Param are required",
    });
  }

  try {
    // param = 1 activar
    // param = 0 desactivar
    const result = await sequelize.query(
      "call spDeactivateUser(:user_param,:user_id)",
      {
        replacements: { user_param: param, user_id: idUser },
      }
    );
    res.status(201).json({
      message: "User updated",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: "Error",
    });
  }
});

// Actualizar contrasenia
router.put("/update/pass/:idUser", authenticateToken, async (req, res) => {
  const { idUser } = req.params;
  const { password_hash } = req.body;

  if (!password_hash) {
    return res.status(400).json({
      ok: false,
      message: "Password are required",
    });
  }

  try {
    const userData = {};
    if (password_hash) userData.password_hash = password_hash;

    const hashedPassword = await bcrypt.hash(password_hash, 10);
    const result = await sequelize.query(
      "call spUpdatePassword(:user_id,:pass);",
      {
        replacements: { user_id: idUser, pass: hashedPassword },
      }
    );
    res.status(201).json({
      message: "password updated",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: "Error",
    });
  }
});

module.exports = router;
