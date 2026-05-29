numList = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
primes = 0
primeList = []
for num in numList:
    if num > 1:
        isPrime = True
        for i in range(2, num):
            if (num%i == 0):
                isPrime = False
        if isPrime:
            primes += 1
            primeList.append(num)
            
print(f"Number of primes: {primes}")
print(f"Primes: {primeList}")