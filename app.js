const crypto = require('crypto');
const app = express();
const axios = require('axios');
const stripe = require('stripe')('tu_secret_key_de_stripe');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const dotenv = require('dotenv');
const QRCode = require('qrcode');

function generateToken(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}


dotenv.config({ path: './env/.env' });

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/public', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// Conexion a MongoDB
mongoose.connect('mongodb://localhost/Human_System', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Conectado a MongoDB');
}).catch(err => {
    console.error('Error conectando a MongoDB', err);
});


// Definir esquema y modelo para Humanos
const humanSchema = new mongoose.Schema({
    humanoID: { type: String, unique: true },  // Cambiado a humanoID
    nombre: String,
    direccion: String,
    correo: String,
    telefono: String,
    fecha_nacimiento: Date,
    contraseña: String,
    lugarNacimiento: String,  // Agregado el campo lugarNacimiento
    qrCode: String,
    descripcion: String
});
const Human = mongoose.model('Human', humanSchema);

app.get('/login', (req, res) => {
    if(req.session.loggedin) { // Si el usuario ya ha iniciado sesión, redirigir al inicio
        res.redirect('/');
        return;
    }
    res.render('login', { title: 'Iniciar Sesión' });
});

app.get('/register', (req, res) => {
    res.render('register', { title: 'Registrarse' });
});

app.get('/', async (req, res) => {
    if(req.session.loggedin) {
        try {
            // Obtener el documento del usuario de la base de datos
            const user = await Human.findOne({ humanoID: req.session.humano });

            if (user) {
                // Renderizar la vista con las variables necesarias
                res.render('index', { 
                    title: 'Página de Inicio', 
                    nombre: user.nombre,
                    humano: user.humanoID,
                    login: req.session.loggedin,
                    qrCode: user.qrCode,
                    descripcion: user.descripcion   // Añade esta línea
                });
            } else {
                // Redirige al login si no se encuentra el usuario
                res.redirect('/login');
            }
        } catch (error) {
            console.error("Error al obtener información del usuario:", error);
            res.redirect('/login');
        }
    } else {
        // Si el usuario no ha iniciado sesión, redirige al login
        res.redirect('/login');
    }
});




app.post('/publicar-publicacion', async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ success: false, message: "El cuerpo de la solicitud está vacío" });
        }

        const { titulo, texto } = req.body; // Agrega esta línea para obtener el título y el texto de la publicación

        if (!titulo || !texto) {
            return res.status(400).json({ success: false, message: "Los campos título y texto son requeridos" });
        }

        // Generar un token único para la publicación
        const token = generateToken(titulo + texto);

        if (req.session && req.session.humano) {
            // Obtener el ID del usuario desde la sesión
            const humanoID = req.session.humano;

           const nuevaPublicacion = new Publicacion({
                titulo: titulo,
                texto: texto,
                token: token,
                humanoID: humanoID // Asigna el humanoID del usuario que está realizando la publicación
            });

            await nuevaPublicacion.save();

            res.json({ success: true, token: token });
        } else {
            res.json({ success: false, message: 'No se pudo identificar al usuario.' });
        }
    } catch (error) {
        console.error('Error al publicar la publicación:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});



const publicacionSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: true
    },
    texto: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    fecha: {
        type: Date,
        required: true,
        default: Date.now
    },
    humanoID: {
        type: String,
        ref: 'Human',
        required: true
    }
});

const Publicacion = mongoose.model('Publicacion', publicacionSchema);

module.exports = Publicacion;

app.get('/obtener-publicaciones', async (req, res) => {
    try {
        const publicaciones = await Publicacion.find({});
        res.json({ success: true, publicaciones: publicaciones });
    } catch (error) {
        console.error("Error al obtener publicaciones:", error);
        res.status(500).json({ success: false, message: error.message || 'Error desconocido' });
    }
});


// Ruta para obtener respuestas de OpenAI
app.post('/get-response', async (req, res) => {
	try {
	  const userMessage = req.body.message;
	  const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
		prompt: userMessage,
		max_tokens: 100
	  }, {
		headers: {
		  'Authorization': 'Bearer YOUR_API_KEY'
		}
	  });
	  const modelResponse = response.data.choices[0].text;
	  res.json({ message: modelResponse });
	} catch (error) {
	  console.error(error);
	  res.status(500).send('Internal Server Error');
	}
  });
  
  // Ruta para manejar transferencias de Stripe
  app.post('/tu_endpoint_del_servidor', async (req, res) => {
	  try {
		  let amount = req.body.amount;
		  let transfer = await stripe.transfers.create({
			  amount: amount,
			  currency: 'usd',
			  destination: '{{CONNECTED_STRIPE_ACCOUNT_ID}}',
		  });
		  res.json({ success: true, transfer: transfer });
	  } catch(error) {
		  console.error('Error al realizar la transferencia', error);
		  res.status(500).json({ success: false, error: error.message });
	  }
  });

  app.post('/register', async (req, res) => {
    try {
        const { nombre, direccion, correo, telefono, fecha_nacimiento, contrasena1, contrasena2, lugarNacimiento } = req.body;

        // Validar que las contraseñas coincidan
        if (contrasena1 !== contrasena2) {
            return res.render('register', {
                alert: true,
                alertTitle: "Error en Contraseña",
                alertMessage: "Las contraseñas no coinciden",
                alertIcon: 'error',
                showConfirmButton: true,
                timer: false,
                ruta: 'register'
            });
        }

        // Validar la longitud de la contraseña
        if (contrasena1.length < 8 || contrasena1.length > 20) {
            return res.render('register', {
                alert: true,
                alertTitle: "Error en Contraseña",
                alertMessage: "La contraseña debe tener entre 8 y 20 caracteres",
                alertIcon: 'error',
                showConfirmButton: true,
                timer: false,
                ruta: 'register'
            });
        }

        // (Opcional) Validar el contenido de la contraseña
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
        if (!regex.test(contrasena1)) {
            return res.render('register', {
                alert: true,
                alertTitle: "Error en Contraseña",
                alertMessage: "La contraseña debe contener al menos una letra mayúscula, una letra minúscula y un número",
                alertIcon: 'error',
                showConfirmButton: true,
                timer: false,
                ruta: 'register'
            });
        }

        const humanoID = generateHumanID(nombre, fecha_nacimiento, lugarNacimiento);

        const passwordHash = await bcrypt.hash(contrasena1, 8);

        const qrData = 'Nombre: ' + nombre + '\nID: ' + humanoID;
        const qrDataURL = await QRCode.toDataURL(qrData);

        const newHuman = new Human({
            humanoID,
            nombre,
            direccion,
            correo,
            telefono,
            fecha_nacimiento,
            contraseña: passwordHash,
            lugarNacimiento,
            qrCode: qrDataURL,
        });

        await newHuman.save();

        res.render('register', {
            alert: true,
            alertTitle: "Registro exitoso",
            alertMessage: "¡Felicidades! ya puedes acceder al Sistema de Identificación Humana",
            alertIcon: 'success',
            showConfirmButton: false,
            timer: 2300,
            ruta: 'login'
        });

    } catch (error) {
        console.error("Error al registrar un usuario:", error);
        res.render('register', {
            alert: true,
            alertTitle: "Error",
            alertMessage: "Hubo un error durante el registro",
            alertIcon: 'error',
            showConfirmButton: true,
            timer: false,
            ruta: 'register'
        });
    }
});


app.post('/auth', async (req, res) => {
    try {
        const { humano, contraseña } = req.body;

        // Verificar si el formulario está vacío
        if (!humano || !contraseña) {
            return res.render('login', {
                alert: true,
                alertTitle: "Ingresa",
                alertMessage: "Ingresa tus datos personales",
                alertIcon: 'question',
                showConfirmButton: false,
                timer: 2300,
                ruta: 'login'
            });
        }

        const user = await Human.findOne({ humanoID: humano });
        // Si no se encuentra el usuario o la contraseña es incorrecta
        if (!user || !(await bcrypt.compare(contraseña, user.contraseña))) {
            return res.render('login', {
				alert: true,
				alertTitle: "Error!",
				alertMessage: "Humano y/o contraseña incorrectos",
				alertIcon: 'error',
				showConfirmButton: true,
				timer: false,
				ruta: 'login'    
			});
        } 
        
        // Usuario autenticado con éxito
        req.session.loggedin = true;                
        req.session.nombre = user.nombre;
        req.session.humano = user.humanoID;
        return res.render('login', {
            alert: true,
            alertTitle: req.session.nombre,
            alertMessage: req.session.humanoID,
            alertIcon: 'success',
            showConfirmButton: false,
            timer: 2300,
            ruta: ''
        });
        
    } catch (error) {
        // Error inesperado
        console.error("Error inesperado:", error);
        return res.render('login', {
            alert: true,
            alertTitle: "Error",
            alertMessage: "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
            alertIcon: 'error',
            showConfirmButton: false,
            timer: 2300,
            ruta: 'login'
        });
    }
});

// Ruta para obtener el humanoID desde la sesión
app.get('/obtener-humano-id', (req, res) => {
    if (req.session.loggedin && req.session.humano) {
        res.json({ success: true, humanoID: req.session.humano });
    } else {
        res.json({ success: false, message: 'Usuario no autenticado.' });
    }
});




app.post('/actualizar-descripcion', async (req, res) => {
    try {
        const { descripcion } = req.body;

        if(req.session && req.session.humano) {
            await Human.updateOne({ humanoID: req.session.humano }, { descripcion: descripcion });
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'No se pudo identificar al usuario.' });
        }
    } catch (error) {
        console.error('Error al actualizar la descripción:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});


function generateHumanID(nombre, fecha_nacimiento, lugarNacimiento) {
    let [primerNombre, primerApellido, segundoApellido] = nombre.split(' ');

    let id = `${primerApellido.substring(0, 2)}${segundoApellido.substring(0, 2)}${primerNombre.substring(0, 2)}${fecha_nacimiento.replace(/-/g, '')}${lugarNacimiento.substring(0,3)}`;
    
    return id.toUpperCase();
}


app.get('/logout', function (req, res) {
	req.session.destroy(() => {
	  res.redirect('login') // siempre se ejecutará después de que se destruya la sesión
	})
});

app.listen(3013, function() {
    console.log('Servidor escuchando en el puerto 3013');
  });



module.exports.handler = require('serverless-http')(app);