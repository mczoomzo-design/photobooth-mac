/* Convert the mono slip PNG (data URL) into ESC/POS bytes for an 80mm printer.
   Same algorithm as the Android EscPos.java: scale to 576px width, grayscale,
   Floyd–Steinberg dither, then GS v 0 raster in 128-row bands + feed + cut. */
window.slipToEscPos = function (dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const W = 576;
        const H = Math.max(1, Math.round(img.height * (W / img.width)));
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);   // composite onto white
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;

        const gray = new Float32Array(W * H);
        for (let i = 0, p = 0; i < W * H; i++, p += 4) {
          const a = data[p + 3] / 255;
          gray[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) * a + 255 * (1 - a);
        }
        const black = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = y * W + x;
            const oldv = gray[i];
            const newv = oldv < 128 ? 0 : 255;
            black[i] = newv === 0 ? 1 : 0;
            const err = oldv - newv;
            if (x + 1 < W) gray[i + 1] += err * 7 / 16;
            if (y + 1 < H) {
              if (x > 0) gray[i + W - 1] += err * 3 / 16;
              gray[i + W] += err * 5 / 16;
              if (x + 1 < W) gray[i + W + 1] += err * 1 / 16;
            }
          }
        }

        const bpr = (W + 7) >> 3;
        const out = [];
        out.push(0x1B, 0x40);          // ESC @  init
        out.push(0x1B, 0x61, 0x01);    // ESC a 1  center
        const band = 128;
        for (let y0 = 0; y0 < H; y0 += band) {
          const bh = Math.min(band, H - y0);
          out.push(0x1D, 0x76, 0x30, 0x00, bpr & 0xff, (bpr >> 8) & 0xff, bh & 0xff, (bh >> 8) & 0xff);
          for (let y = 0; y < bh; y++) {
            for (let bx = 0; bx < bpr; bx++) {
              let val = 0;
              for (let bit = 0; bit < 8; bit++) {
                const x = bx * 8 + bit;
                if (x < W && black[(y0 + y) * W + x]) val |= (0x80 >> bit);
              }
              out.push(val);
            }
          }
        }
        out.push(0x1B, 0x64, 0x04);    // ESC d 4  feed
        out.push(0x1D, 0x56, 0x01);    // GS V 1   partial cut
        resolve(Uint8Array.from(out));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = dataURL;
  });
};
