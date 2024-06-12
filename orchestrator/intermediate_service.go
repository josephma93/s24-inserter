package main

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "os"
    "os/exec"
    "strings"

    "github.com/go-redis/redis/v8"
    "github.com/joho/godotenv"
)

type Params struct {
    Date            string `json:"date"`
    TransactionType string `json:"transactionType"`
    WorldDonations  string `json:"worldDonations"`
    LocalDonations  string `json:"localDonations"`
}

type Feedback struct {
    Status  string `json:"status"`
    Message string `json:"message"`
}

var (
    redisHost        string
    redisPassword    string
    queueName        = "puppeteer_queue"
    feedbackQueue    = "puppeteer_feedback"
    scriptDir        string
    debug            bool
    ctx              = context.Background()
    redisClient      *redis.Client
)

func main() {
    // Determinar la ruta del archivo .env
    envPath := os.Getenv("ENV_PATH")
    if envPath == "" {
        envPath = "./.env"
    }

    // Cargar variables de entorno desde el archivo .env
    err := godotenv.Load(envPath)
    if err != nil {
        log.Fatalf("Error loading .env file: %v", err)
    }

    redisHost = os.Getenv("REDIS_HOST")
    redisPassword = os.Getenv("REDIS_PASSWORD")
    scriptDir = os.Getenv("SCRIPT_DIR")
    debug = os.Getenv("DEBUG") == "true"

    if debug {
        log.Printf("DEBUG: REDIS_HOST=%s, REDIS_PASSWORD=%s, SCRIPT_DIR=%s, DEBUG=%v", redisHost, redisPassword, scriptDir, debug)
    }

    redisClient = redis.NewClient(&redis.Options{
        Addr:     redisHost,
        Password: redisPassword,
        DB:       0,
    })

    status, err := redisClient.Ping(ctx).Result()
    if err != nil {
        log.Fatalf("Error connecting to Redis: %v", err)
    }

    if debug {
        log.Printf("DEBUG: Redis Ping Status: %v", status)
    }

    pubsub := redisClient.Subscribe(ctx, queueName)
    defer pubsub.Close()

    if debug {
        log.Printf("DEBUG: Subscribed to queue: %s", queueName)
    }

    ch := pubsub.Channel()

    log.Println("Starting puppeteer intermediate service...")

    for msg := range ch {
        if debug {
            log.Printf("DEBUG: Received raw message: %v", msg)
        }
        log.Printf("Received message: %s", msg.Payload)
        var params Params
        if err := json.Unmarshal([]byte(msg.Payload), &params); err != nil {
            log.Printf("Failed to parse message: %v", err)
            publishFeedback("error", fmt.Sprintf("Failed to parse message: %v", err))
            continue
        }

        log.Printf("Parsed params: %+v", params)
        publishFeedback("info", "Received message and starting Docker command execution.")
        runDockerCommand(params)
    }
}

func runDockerCommand(params Params) {
    dockerCmdParts := []string{
        "mkdir -p /home/pptruser/workdir &&",
        "cp -r /home/pptruser/app/{.,}* /home/pptruser/workdir/ &&",
        "cd /home/pptruser/workdir &&",
        "npm ci &&",
        fmt.Sprintf("node insert-s-24-record.mjs --action %s --date %s --world-work-amount %s --congregation-amount %s",
            params.TransactionType, params.Date, params.WorldDonations, params.LocalDonations),
    }
    dockerCmd := strings.Join(dockerCmdParts, " ")

    cmd := exec.Command("docker", "run", "-i", "--rm", "--init", "--cap-add=SYS_ADMIN",
        "-v", fmt.Sprintf("%s:/home/pptruser/app:ro", scriptDir),
        "ghcr.io/puppeteer/puppeteer:22.10.0",
        "bash", "-c", dockerCmd)

    if debug {
        log.Printf("DEBUG: Docker command: %s", cmd.String())
    }

    stdout, err := cmd.StdoutPipe()
    if err != nil {
        log.Fatalf("Failed to get stdout pipe: %v", err)
    }

    stderr, err := cmd.StderrPipe()
    if err != nil {
        log.Fatalf("Failed to get stderr pipe: %v", err)
    }

    if err := cmd.Start(); err != nil {
        log.Fatalf("Failed to start Docker command: %v", err)
    }

    go io.Copy(os.Stdout, stdout)
    go io.Copy(os.Stderr, stderr)

    err = cmd.Wait()
    exitError, ok := err.(*exec.ExitError)
    if ok {
        exitCode := exitError.ExitCode()
        publishFeedback("error", fmt.Sprintf("Puppeteer script execution failed with exit code %d: %v", exitCode, err))
        publishFeedback("error", fmt.Sprintf("Docker output: %s", exitError.Stderr))
        log.Printf("Puppeteer script execution failed with exit code %d: %v", exitCode, err)
        log.Printf("Docker output: %s", exitError.Stderr)
    } else if err != nil {
        publishFeedback("error", fmt.Sprintf("Puppeteer script execution failed: %v", err))
        log.Printf("Puppeteer script execution failed: %v", err)
    } else {
        publishFeedback("info", "Puppeteer script executed successfully.")
        log.Printf("Puppeteer script executed successfully.")
    }

    log.Println("Returning to subscriber mode.")
    publishFeedback("info", "Returning to subscriber mode.")
}

func publishFeedback(status, message string) {
    feedback := Feedback{
        Status:  status,
        Message: message,
    }
    feedbackJSON, err := json.Marshal(feedback)
    if err != nil {
        log.Printf("Failed to marshal feedback: %v", err)
        return
    }

    err = redisClient.Publish(ctx, feedbackQueue, feedbackJSON).Err()
    if err != nil {
        log.Printf("Failed to publish feedback: %v", err)
    }
}
