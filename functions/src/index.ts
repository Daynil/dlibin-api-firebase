import * as functions from 'firebase-functions';
import { arrContains } from './utilities';

let sendGridMail;
let firebaseAdmin: typeof import('firebase-admin') | null = null;

export const ping = functions.https.onRequest((req, res) => {
  res.send('success');
});

export const getDocument = functions.https.onRequest(async (req, res) => {
  const allowedOrigins = [
    'https://www.innerpathllc.com',
    'https://elastic-meitner-cb47ec.netlify.app'
    //'http://localhost:8000' // testing only
  ];
  const allowedOrigin = arrContains(allowedOrigins, req.get('Origin') || '');

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  if (!allowedOrigin) {
    res.status(401).end();
    return;
  }

  res.set('Access-Control-Allow-Origin', allowedOrigin);

  if (!firebaseAdmin) {
    firebaseAdmin = await import('firebase-admin');
    const serviceAccount = require('../dlibin-api-ca89a-firebase-adminsdk-coeic-d6cb178bcb.json');
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
      storageBucket: 'dlibin-api-ca89a.appspot.com'
    });
  }

  const bucket = firebaseAdmin.storage().bucket();

  const documentName = req.params[0].split('/')[1];

  const file = bucket.file(`innerpath/${documentName}`);
  const [fileMetadata] = await file.getMetadata();

  res.set({
    'Content-Type': fileMetadata.contentType,
    'Content-Length': fileMetadata.size,
    'Content-Disposition': `attachment; filename="${fileMetadata.name}"`
  });

  // For some truly bizarre reason, piping the file readStream directly to res
  //  sends the file, but never terminates the function so it hangs and times out.
  //  Also won't let me listen to stream end if it's piped to res, so I can't manually end it.
  // Manually construct a buffer and send it when the stream is complete instead.
  const bufferArr: Buffer[] = [];

  file
    .createReadStream()
    .on('error', (e) => {
      console.error('Send Document Error', e.toString());
      res.status(500).end();
    })
    .on('data', (d) => bufferArr.push(d as Buffer))
    .on('end', () => res.send(Buffer.concat(bufferArr)));
});

export const postEmail = functions.https.onRequest(async (req, res) => {
  const allowedOrigins = [
    'https://www.innerpathllc.com',
    'https://dlibin.net',
    'https://elastic-meitner-cb47ec.netlify.app'
    //'http://localhost:8000' // testing only
  ];
  const allowedOrigin = arrContains(allowedOrigins, req.get('Origin') || '');

  if (req.method === 'OPTIONS') {
    if (allowedOrigin) {
      res.set('Access-Control-Allow-Origin', allowedOrigin);
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).end();
    } else {
      res.status(401).end();
    }
    return;
  } else if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  if (!allowedOrigin) {
    res.status(401).end();
    return;
  }

  res.set('Access-Control-Allow-Origin', allowedOrigin);

  sendGridMail = await import('@sendgrid/mail');

  const mailData = JSON.parse(req.body);
  if (!mailData.subject) mailData.subject = 'Footer contact';

  sendGridMail.setApiKey(functions.config().sendgrid.apikey);

  try {
    await sendGridMail.send({
      from: mailData.email,
      to: 'innerpath.inquiries@gmail.com',
      //to: 'omegasol11@gmail.com', // testing only
      subject: mailData.subject,
      html: `
        <div><b>Name:</b> ${mailData.first} ${mailData.last}</div>
        <div><b>Message:</b></div>
        <div>${mailData.body}</div>
      `
    });
    res.status(200).end();
  } catch (e) {
    console.error('Sendgrid error', e.toString());
    res.status(500).end();
  }
});
