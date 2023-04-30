// 1 - Invocamos a Express
const express = require('express');
const app = express();

//2 - Para poder capturar los datos del formulario
app.use(express.urlencoded({extended:false}));
app.use(express.json());

//3- Invocamos a dotenv
const dotenv = require('dotenv');
dotenv.config({ path: './env/.env'});

//4 -seteamos el directorio de assets
app.use('/resources',express.static('public'));
app.use('/resources', express.static(__dirname + '/public'));

//5 - Establecemos el motor de plantillas
app.set('view engine','ejs');

//6 -Invocamos a bcrypt
const bcrypt = require('bcryptjs');

//7- variables de session
const session = require('express-session');
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));


// 8 - Invocamos a la conexion de la DB
const connection = require('./database/db');


//9 - establecemos las rutas
	app.get('/login',(req, res)=>{
		res.render('login');
	})

	app.get('/register',(req, res)=>{
		res.render('register');
	})

	app.get('/verification',(req, res)=>{
		res.render('index');
	})

	app.get('/index',(req, res)=>{
		res.render('index');
})

//10 - Método para la REGISTRACIÓN
app.post('/register', async (req, res)=>{
	const nombre = req.body.nombre;
	const direccion = req.body.direccion;
	const correo = req.body.correo;	
	const telefono = req.body.telefono; 
	const curp = req.body.curp;
	const rfc = req.body.rfc;	
	const fecha_nacimiento = req.body.fecha_nacimiento;	
	const tarjeta_chip = req.body.tarjeta_chip;
	const contraseña = req.body.contraseña;
	let passwordHash = await bcrypt.hash(contraseña, 8);
	
	// Generar el código QR de la tarjeta chip del humano
	const QRCode = require('qrcode');
  const Tarjeta_chipQRCode = await QRCode.toDataURL(tarjeta_chip); 

    connection.query('INSERT INTO Humanos SET ?',{nombre:nombre, direccion:direccion, correo:correo, telefono:telefono, curp:curp, rfc:rfc, fecha_nacimiento:fecha_nacimiento, contraseña:passwordHash, tarjeta_chip:tarjeta_chip}, async (error, results)=>{
        if(error){
			res.render('register', {
				alert: false,
				alertTitle: "Registro erroneo",
				alertMessage: "Lo sentimos, hay un problema con tu registro humano",
				alertIcon:'error',
				showConfirmButton: true,
				timer: 2300,
				ruta:'register'
			});
        }else{            
			res.render('register', {
				alert: true,
				alertTitle: "Registro exitoso",
				alertMessage: "¡Felicidades! ya pudes acceder al Sistema de Identificación Humana",
				alertIcon:'success',
				showConfirmButton: false,
				timer: 2300,
				ruta: 'login'
			});   
        }
	});
})


//11 - Metodo para la autenticacion index
app.post('/auth', async (req, res)=> {
	const curp = req.body.curp;
	const contraseña = req.body.contraseña;    
    let passwordHash = await bcrypt.hash(contraseña, 8);
	if (curp && contraseña) {
		connection.query('SELECT * FROM Humanos WHERE curp = ?', [curp], async (error, results, fields)=> {
			if( results.length == 0 || !(await bcrypt.compare(contraseña, results[0].contraseña)) ) {    
				res.render('login', {
                        alert: true,
                        alertTitle: "Error!",
                        alertMessage: "CURP y/o contraseña incorrectos",
                        alertIcon:'error',
                        showConfirmButton: true,
                        timer: false,
                        ruta: 'login'    
                    });			
			} else {         
				//creamos una var de session y le asignamos true si INICIO SESSION       
				req.session.loggedin = true;                
				req.session.nombre = results[0].nombre;
				req.session.curp = results[0].curp;
				req.session.tarjeta_chip = results[0].tarjeta_chip;
				res.render('login', {
					alert: true,
					alertTitle: req.session.nombre,
					alertMessage: req.session.curp,
					alertIcon:'success',
					showConfirmButton: false,
					timer: 2300,
					ruta: ''
				});        			
			}			
			res.end();
		});
	} else {	
		res.render('login', {
			alert: true,
			alertTitle: "Ingresa",
			alertMessage: "Ingresa tus datos personales",
			alertIcon:'question',
			showConfirmButton: false,
			timer: 2300,
			ruta: 'login'
		});  
	}
});


//11 - Metodo para la autenticacion validation
app.post('/verification', async (req, res)=> {
const tarjeta_chip = req.body.tarjeta_chip;  
	if (tarjeta_chip) {
		connection.query('SELECT * FROM humanos WHERE tarjeta_chip = ?', [tarjeta_chip], async (error, results, fields)=> {
			if( results.length == 0) {    
				res.render('login', {
					alert: true,
					alertTitle: "ID erronea:",
					alertMessage: req.body.tarjeta_chip,
					alertIcon:'error',
					showConfirmButton: true,
					timer: false,
					ruta: ''    
                    });			
			} else {       
				req.session.loggedin = true;
				req.session.curp = results[0].curp;
				req.session.tarjeta_chip = results[0].tarjeta_chip;        
				res.render('login', {
					alert: true,
					alertTitle: req.session.curp,
					alertMessage: req.body.tarjeta_chip,
					alertIcon:'success',
					showConfirmButton: false,
					timer: 2300,
					ruta: '',
				});        			
			}			
			res.end();
		});
	} else {	
		res.render('login', {
			alert: true,
			alertTitle: "Ingresa",
			alertMessage: "Ingresa el numero de identificación humana",
			alertIcon:'question',
			showConfirmButton: false,
			timer: 2300,
			ruta: ''
		});  
	}
});


//12 - Método para controlar que está auth en todas las páginas
app.get('', (req, res)=> {
	if (req.session.loggedin) {
		res.render('index',{
			login: true,
			nombre: req.session.nombre,
			curp: req.session.curp,
			tarjeta_chip: req.session.tarjeta_chip,
			});	
	} else{
		res.render('index',{	
			login: false,
			nombre:'Sergio Campos Medina',
			CURP: 'CAMS000904HDFMDRA9', 
			ID:'4332-4456-2892-74890',
		});				
	}
	res.end();
});


//función para limpiar la caché luego del logout
app.use(function(req, res, next) {
    if (!req.curp)
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    next();
});

 //Logout
//Destruye la sesión.
app.get('/logout', function (req, res) {
	req.session.destroy(() => {
	  res.redirect('login') // siempre se ejecutará después de que se destruya la sesión
	})
});


app.listen(3006, (req, res)=>{
    console.log('SERVER RUNNING IN http://localhost:3006');
});