package main

import (
	"os/exec"
	"strconv"
	"strings"
	"time"
)

func main() {
	cmd := exec.Command(`C:\xampp\xampp_start.exe`)
	err := cmd.Start()
	if err != nil {
		return
	}

	time.Sleep(5 * time.Second)

	ports := []int{2377, 2399, 4000}

	for _, port := range ports {
		killProcessOnPort(port)
	}

	cmd = exec.Command("cmd", "/c", "cd /d \"C:\\Programming\\PLS-DIFFERENT-VERSIONS\\LobnosProfessionalVersion\\lobnos-server\" && start \"LobnosServer\" cmd /c \"npm run start >nul 2>&1\"")
	err = cmd.Start()
	if err != nil {
		return
	}
}

func killProcessOnPort(port int) {
	cmd := exec.Command("netstat", "-aon")
	output, err := cmd.Output()
	if err != nil {
		return
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, ":"+strconv.Itoa(port)) {
			fields := strings.Fields(line)
			if len(fields) >= 5 {
				pid := fields[4]
				if pid != "0" {
					killCmd := exec.Command("taskkill", "/F", "/PID", pid)
					killCmd.Run()
				}
			}
		}
	}
}
