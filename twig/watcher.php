<?php
require __DIR__ . '/vendor/autoload.php';

use Spatie\Watcher\Watch;

Watch::path(__DIR__ . '/templates', __DIR__)
    ->onAnyChange(function (string $type, string $path) {
        echo "Arquivo alterado: {$path}\n";
        // Reinicie o servidor manualmente ou via script
        shell_exec('php -S localhost:8080 index.php');
    })
    ->start();
