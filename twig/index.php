<?php

use DI\Container;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;

require __DIR__ . '/vendor/autoload.php';

$container = new Container();
AppFactory::setContainer($container);
$app = AppFactory::create();

$container->set('settings', function () {
    return [
        'twig' => [
            'path' => __DIR__ . '/templates',
            'cache_enabled' => false,
            'cache_path' => __DIR__ . '/cache/twig',
        ],
        'public' => __DIR__ . '/public',
        'assets' => [
            'path' => __DIR__ . '/public',
            'basePath' => '/public',
            'cachePath' => __DIR__ . '/public/cache',
        ],
    ];
});

$container->set('view', function (Container $container) {
    $settings = $container->get('settings');
    $twig = Twig::create($settings['twig']['path'], [
        'cache' => $settings['twig']['cache_enabled'] ? $settings['twig']['cache_path'] : false,
        'debug' => true
    ]);

    $twig->getEnvironment()->addFunction(new \Twig\TwigFunction('asset', function ($path) {
        $path = preg_replace('#/+#', '/', ltrim($path, '/'));
        return '/asset/' . $path;
    }));

    return $twig;
});

$app->add(function (Request $request, $handler) {
    $uri = $request->getUri();
    $path = $uri->getPath();

    if (preg_match('/\.(css|js|png|jpg|jpeg|gif|svg|ico)$/', $path)) {
        $filePath = __DIR__ . '/public' . $path;

        if (file_exists($filePath) && is_file($filePath)) {
            $mimeTypes = [
                'css'  => 'text/css',
                'js'   => 'application/javascript',
                'png'  => 'image/png',
                'jpg'  => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'gif'  => 'image/gif',
                'svg'  => 'image/svg+xml',
                'ico'  => 'image/x-icon'
            ];

            $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
            $contentType = $mimeTypes[$ext] ?? mime_content_type($filePath);

            $response = new \Slim\Psr7\Response();
            $response->getBody()->write(file_get_contents($filePath));
            return $response->withHeader('Content-Type', $contentType);
        }
    }

    return $handler->handle($request);
});

$app->add(TwigMiddleware::createFromContainer($app));

$app->get('/', function (Request $request, Response $response, $args) {
    return $this->get('view')->render($response, 'home.html.twig', ['title' => 'Home']);
});

$app->run();
