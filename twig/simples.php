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

$container->set('view', function () {
    return Twig::create('templates', ['cache' => false, 'auto_reload' => true, 'debug' => true]);
});

$app->add(TwigMiddleware::createFromContainer($app));

$app->get('/', function (Request $request, Response $response, $args) {
    return $this->get('view')->render($response, 'home.html.twig', ['title' => 'Home']);
});


$app->run();
