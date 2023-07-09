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
app.use('/public/css', express.static(__dirname + '/public/css', { 
	setHeaders: (res, path) => {
	  res.setHeader('Content-Type', 'text/css');
	}
  }));
  

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


app.listen(3007, (req, res)=>{
    console.log('SERVER RUNNING IN http://localhost:3007');
});


var payment = require('crypto-payment-url')
var qr = require('crypto-payment-url/qrcode')

// Generar URL de pago Ethereum para 1000 Wei y generar el código QR
var ethereumPaymentUrl = payment.ethereum({ address: '0x06D7b160F31C8a017b28F5dfbD784d29c4b12A04', amount: 1000 });
var ethereumPaymentQr = qr.ethereum({ address: '0x4ec8bb2d0bba6314c43dd41f5ae00e06dd8591e9', amount: 1000 });

// Generar URL de pago Bitcoin y generar el código QR
var bitcoinPaymentUrl = payment.bitcoin({ lightning: 'lnbc9678785340p1pwmna7lpp5gc3xfm08u9qy06djf8dfflhugl6p7lgza6dsjxq454gxhj9t7a0sd8dgfkx7cmtwd68yetpd5s9xar0wfjn5gpc8qhrsdfq24f5ggrxdaezqsnvda3kkum5wfjkzmfqf3jkgem9wgsyuctwdus9xgrcyqcjcgpzgfskx6eqf9hzqnteypzxz7fzypfhg6trddjhygrcyqezcgpzfysywmm5ypxxjemgw3hxjmn8yptk7untd9hxwg3q2d6xjcmtv4ezq7pqxgsxzmnyyqcjqmt0wfjjq6t5v4khxxqyjw5qcqp2rzjq0gxwkzc8w6323m55m4jyxcjwmy7stt9hwkwe2qxmy8zpsgg7jcuwz87fcqqeuqqqyqqqqlgqqqqn3qq9qn07ytgrxxzad9hc4xt3mawjjt8znfv8xzscs7007v9gh9j569lencxa8xeujzkxs0uamak9aln6ez02uunw6rd2ht2sqe4hz8thcdagpleym0j' });
var bitcoinPaymentQr = qr.bitcoin({ lightning: 'lnbc9678785340p1pwmna7lpp5gc3xfm08u9qy06djf8dfflhugl6p7lgza6dsjxq454gxhj9t7a0sd8dgfkx7cmtwd68yetpd5s9xar0wfjn5gpc8qhrsdfq24f5ggrxdaezqsnvda3kkum5wfjkzmfqf3jkgem9wgsyuctwdus9xgrcyqcjcgpzgfskx6eqf9hzqnteypzxz7fzypfhg6trddjhygrcyqezcgpzfysywmm5ypxxjemgw3hxjmn8yptk7untd9hxwg3q2d6xjcmtv4ezq7pqxgsxzmnyyqcjqmt0wfjjq6t5v4khxxqyjw5qcqp2rzjq0gxwkzc8w6323m55m4jyxcjwmy7stt9hwkwe2qxmy8zpsgg7jcuwz87fcqqeuqqqyqqqqlgqqqqn3qq9qn07ytgrxxzad9hc4xt3mawjjt8znfv8xzscs7007v9gh9j569lencxa8xeujzkxs0uamak9aln6ez02uunw6rd2ht2sqe4hz8thcdagpleym0j' });

// Agregar los códigos QR generados en el formulario
// document.getElementById('amount').insertAdjacentHTML('afterend', `<img src="${ethereumPaymentQr}">`);
// document.getElementById('recipient_account').insertAdjacentHTML('afterend', `<img src="${bitcoinPaymentQr}">`);