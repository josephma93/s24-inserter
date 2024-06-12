### Instrucciones para Pasar el Programa al Servidor y Probarlo sin Habilitarlo como Servicio

1. **Compilar el Programa para Linux**:
- En tu máquina de desarrollo (Mac), compila el programa para Linux:
```bash
export GOOS=linux
export GOARCH=amd64
go build -o intermediate_service intermediate_service.go
```

2. **Transferir el Binario y el Archivo `.env` al Servidor**:
- Usa `scp` para transferir el binario y el archivo `.env` al servidor:
```bash
scp intermediate_service user@yourserver:/server/path/intermediate_service
scp .env user@yourserver:/server/path/
```

3. **Asignar Permisos de Ejecución al Binario en el Servidor**:
- SSH al servidor y asigna permisos de ejecución al binario:
```bash
ssh user@yourserver
chmod +x /server/path/intermediate_service
```

4. **Configurar las Variables de Entorno en el Servidor**:
- Asegúrate de que las variables de entorno necesarias están configuradas en el archivo `.env`:
```ini
REDIS_HOST=127.0.0.1:6379
REDIS_PASSWORD=your_redis_password
SCRIPT_DIR=/server/path/puppeteer
DEBUG=true
```

5. **Probar el Programa en el Servidor**:
- Ejecuta el binario para probarlo, asegurándote de pasar la variable `ENV_PATH`:
```bash
ENV_PATH=/server/path/.env /server/path/intermediate_service
```

### Instrucciones para Habilitar el Servicio Intermediario como Servicio

1. **Configurar el Archivo de Servicio Systemd**:
- Crea o edita el archivo de servicio Systemd:
```bash
sudo nano /etc/systemd/system/puppeteer_service.service
```

- Añade el siguiente contenido:

```ini
[Unit]
Description=Servicio Intermedio Puppeteer
After=network.target

[Service]
ExecStart=/server/path/intermediate_service
Environment=ENV_PATH=/server/path/.env
Restart=always
User=user

[Install]
WantedBy=multi-user.target
```

2. **Recargar Systemd y Habilitar el Servicio**:
- Recarga los archivos de configuración de Systemd y habilita el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl enable puppeteer_service
sudo systemctl start puppeteer_service
sudo systemctl status puppeteer_service
```

### Instrucciones para Hacer Modificaciones al Servicio

1. **Editar el Archivo de Servicio**:
- Edita el archivo de servicio Systemd:
```bash
sudo nano /etc/systemd/system/puppeteer_service.service
```

2. **Recargar Systemd y Reiniciar el Servicio**:
- Recarga los archivos de configuración de Systemd y reinicia el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl restart puppeteer_service
sudo systemctl status puppeteer_service
```

### Instrucciones para Quitar el Servicio

1. **Detener y Deshabilitar el Servicio**:
```bash
sudo systemctl stop puppeteer_service
sudo systemctl disable puppeteer_service
```

2. **Eliminar el Archivo de Servicio Systemd**:
```bash
sudo rm /etc/systemd/system/puppeteer_service.service
```

3. **Recargar Systemd**:
```bash
sudo systemctl daemon-reload
```

### Instrucciones para Ver los Logs del Servicio para Monitorearlo

1. **Ver los Logs en Tiempo Real**:
- Usa `journalctl` para ver los logs en tiempo real:
```bash
sudo journalctl -u puppeteer_service -f
```

2. **Ver los Logs desde una Fecha Específica**:
- Usa `journalctl` para ver los logs desde una fecha específica:
```bash
sudo journalctl -u puppeteer_service --since "2024-05-24 00:00:00"
```

3. **Ver los Logs con un Límite de Líneas**:
- Usa `journalctl` para ver los últimos 1000 logs:
```bash
sudo journalctl -u puppeteer_service -n 1000
```