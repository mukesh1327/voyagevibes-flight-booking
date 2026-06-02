package in.cloudxplorer.authservice.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DocsController {

    @GetMapping("/docs")
    public String docs() {
        return "redirect:/docs/customer";
    }

    @GetMapping("/docs/customer")
    public String customerDocs() {
        return "redirect:/swagger-ui/index.html?urls.primaryName=customer";
    }

    @GetMapping("/docs/corporate")
    public String corporateDocs() {
        return "redirect:/swagger-ui/index.html?urls.primaryName=corporate";
    }

    @GetMapping("/docs/operations")
    public String operationsDocs() {
        return "redirect:/swagger-ui/index.html?urls.primaryName=operations";
    }
}
