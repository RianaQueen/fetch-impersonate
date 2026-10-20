import FormData from 'form-data';

export default function bodyToStream(body, curlArgs) {
  let inputStream;
  if (body instanceof FormData) {
    const formHeaders = body.getHeaders(); 
    for (const [k, v] of Object.entries(formHeaders)) {
      curlArgs.push('-H', `${k}: ${v}`);
    }

    inputStream = body.getBuffer();

    try {
      const contentLength = body.getLengthSync();
      curlArgs.push('-H', `Content-Length: ${contentLength}`);
    } catch {
    }

    curlArgs.push('--data-binary', '@-');
  } else if (body instanceof Buffer || typeof body === 'string') {
    curlArgs.push('--data-binary', '@-');
    inputStream = body;
  }
  return { inputStream };
}
